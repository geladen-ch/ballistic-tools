#!/usr/bin/env python3
"""Fit a truncated spherical-harmonic series to the EGM2008 geoid grid (dev-time only).

Usage:  python3 tools/weather/fit-geoid.py <path/to/us_nga_egm08_25.tif> [L=72]

Input:  EGM2008 2.5' grid from https://cdn.proj.org/us_nga_egm08_25.tif (80.6 MB, download it once yourself).
        Tiled float32 GeoTIFF, deflate, floating-point predictor (3), pixel-is-point, rows 90 -> -90 deg.
Output: src/weather/geoid-sh.js                coefficient table (Float32, little-endian, base64)
        tests/fixtures/weather/geoid-sh-vectors.json   N at reference points (float64 synthesis of the float32 table),
                                               EGM2008 values at the same points, and global fit statistics.

Method: take every 6th node (15' grid, 721 x 1440), spherical-harmonic analysis by
quadrature (FFT along rows, fully normalised Legendre functions, weights sin(theta) dtheta), truncate at L.
theta = 90 deg - geodetic latitude, used directly (surface fit; no geocentric conversion).
Requires numpy.
"""
import base64, datetime, json, os, struct, sys, zlib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
POINTS = {  # name: (lat, lon) -- reference points
    'Zurich': (47.37, 8.54), 'Zermatt': (46.02, 7.75), 'Berlin': (52.52, 13.40), 'KansasCity': (39.10, -94.58),
    'Tokyo': (35.68, 139.69), 'LaPaz': (-16.50, -68.15), 'Lhasa': (29.65, 91.10), 'Denver': (39.74, -104.99),
    'NorthPole': (89.9, 0.0), 'SouthPole': (-89.9, 123.0), 'Antimeridian': (0.0, 180.0), 'DeadSea': (31.5, 35.5),
}


def read_geotiff(path):
    h = open(path, 'rb').read()
    E = '<' if h[:2] == b'II' else '>'
    off = struct.unpack(E + 'I', h[4:8])[0]
    n = struct.unpack(E + 'H', h[off:off + 2])[0]
    tags = {}
    for i in range(n):
        p = off + 2 + 12 * i
        tag, typ, cnt = struct.unpack(E + 'HHI', h[p:p + 8])
        tags[tag] = (typ, cnt, h[p + 8:p + 12])

    def arr(tag):
        typ, cnt, v = tags[tag]
        f = {3: 'H', 4: 'I', 12: 'd'}[typ]
        sz = struct.calcsize(f) * cnt
        data = v[:sz] if sz <= 4 else h[struct.unpack(E + 'I', v)[0]:][:sz]
        return struct.unpack(E + f * cnt, data)

    W, H = arr(256)[0], arr(257)[0]
    TW, TH = arr(322)[0], arr(323)[0]
    assert arr(259)[0] == 8 and arr(317)[0] == 3 and arr(339)[0] == 3, 'expect deflate + fp predictor + float'
    offs, cnts = arr(324), arr(325)
    sx, sy = arr(33550)[:2]
    x0, y0 = arr(33922)[3:5]
    tpr, tcols = -(-W // TW), -(-H // TH)
    out = np.zeros((tcols * TH, tpr * TW), np.float32)
    for ti in range(len(offs)):
        raw = np.frombuffer(zlib.decompress(h[offs[ti]:offs[ti] + cnts[ti]]), np.uint8).reshape(TH, 4 * TW)
        raw = np.cumsum(raw, axis=1, dtype=np.uint8)            # undo byte differencing (mod 256)
        b = raw.reshape(TH, 4, TW).transpose(0, 2, 1)             # byte planes, most significant first
        b = b[:, :, ::-1] if E == '<' else b
        r, c = divmod(ti, tpr)
        out[r * TH:(r + 1) * TH, c * TW:(c + 1) * TW] = np.ascontiguousarray(b).view(E + 'f4').reshape(TH, TW)
    return out[:H, :W], dict(x0=x0, y0=y0, sx=sx, sy=sy, W=W, H=H)


def alf(L, theta):
    """Fully normalised associated Legendre functions P[n, m, k] at colatitudes theta[k] (no Condon-Shortley)."""
    x, s = np.cos(theta), np.sin(theta)
    P = np.zeros((L + 1, L + 1, len(theta)))
    P[0, 0] = 1
    for m in range(1, L + 1):
        P[m, m] = np.sqrt(3.0 if m == 1 else (2 * m + 1) / (2 * m)) * s * P[m - 1, m - 1]
    for m in range(L):
        P[m + 1, m] = np.sqrt(2 * m + 3) * x * P[m, m]
    for m in range(L + 1):
        for n in range(m + 2, L + 1):
            a = np.sqrt((2 * n - 1) * (2 * n + 1) / ((n - m) * (n + m)))
            b = np.sqrt((2 * n + 1) * (n + m - 1) * (n - m - 1) / ((n - m) * (n + m) * (2 * n - 3)))
            P[n, m] = a * x * P[n - 1, m] - b * P[n - 2, m]
    return P


def synth_points(C, S, L, pts):
    out = []
    for lat, lon in pts:
        P = alf(L, np.radians([90.0 - lat]))[:, :, 0]
        m = np.arange(L + 1)
        lam = np.radians(lon)
        out.append(float(np.sum(np.tril(P * (C * np.cos(m * lam)[None, :] + S * np.sin(m * lam)[None, :])))))
    return out


def bilinear(g, meta, lat, lon):
    fx = ((lon - meta['x0']) / meta['sx']) % meta['W']
    fy = (meta['y0'] - lat) / meta['sy']
    c, r = int(fx), min(int(fy), meta['H'] - 2)
    dx, dy = fx - c, fy - r
    c1 = (c + 1) % meta['W']
    return float(g[r, c] * (1 - dx) * (1 - dy) + g[r, c1] * dx * (1 - dy) + g[r + 1, c] * (1 - dx) * dy + g[r + 1, c1] * dx * dy)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path, L = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 72
    full, meta = read_geotiff(path)
    assert abs(meta['sx'] - 1 / 24) < 1e-9 and meta['y0'] == 90 and meta['x0'] == -180, meta
    g = full[::6, ::6].astype(np.float64)                          # 15' grid, 721 x 1440
    H, W = g.shape
    lat = 90 - 0.25 * np.arange(H)
    lon = -180 + 0.25 * np.arange(W)
    th = np.radians(90 - lat)
    w = np.sin(th) * np.radians(0.25)
    w[0] = w[-1] = 0

    P = alf(L, th)
    F = np.fft.rfft(g, axis=1)[:, :L + 1] * (2 * np.pi / W)
    F = F * np.exp(1j * np.arange(L + 1) * np.radians(-180))[None, :]   # phase so that m*lambda uses true longitude
    C = np.tril(np.einsum('nmr,rm,r->nm', P, F.real, w) / (4 * np.pi))
    S = np.tril(np.einsum('nmr,rm,r->nm', P, -F.imag, w) / (4 * np.pi))
    S[:, 0] = 0

    # Pack: C block (n, m<=n), then S block (n>=1, 1<=m<=n); float32 little-endian.
    packed = [C[n, m] for n in range(L + 1) for m in range(n + 1)] + [S[n, m] for n in range(1, L + 1) for m in range(1, n + 1)]
    f32 = np.array(packed, '<f4')
    assert len(f32) == (L + 1) ** 2
    C32, S32 = np.zeros_like(C), np.zeros_like(S)
    k = 0
    for n in range(L + 1):
        for m in range(n + 1):
            C32[n, m] = f32[k]; k += 1
    for n in range(1, L + 1):
        for m in range(1, n + 1):
            S32[n, m] = f32[k]; k += 1

    # Global statistics of the (float32) series against the 15' grid.
    lam = np.radians(lon)
    m = np.arange(L + 1)
    Cr = np.einsum('nmr,nm->mr', P, C32)
    Sr = np.einsum('nmr,nm->mr', P, S32)
    fit = Cr.T @ np.cos(np.outer(m, lam)) + Sr.T @ np.sin(np.outer(m, lam))
    e = fit - g
    wa = np.repeat(w[:, None], W, 1)
    wa /= wa.sum()
    stats = dict(rms_m=round(float(np.sqrt((wa * e ** 2).sum())), 3),
                 p99_m=round(float(np.quantile(np.abs(e[30:-30]), 0.99)), 3),
                 max_m=round(float(np.abs(e[(np.abs(lat) <= 85)]).max()), 3))

    names = list(POINTS)
    series = synth_points(C32, S32, L, [POINTS[k] for k in names])
    egm = [bilinear(full, meta, *POINTS[k]) for k in names]
    stamp = datetime.date.today().isoformat()
    source = f'EGM2008 2.5\' grid (PROJ CDN us_nga_egm08_25.tif), 15\' subsample, SH analysis to degree {L}, fitted {stamp}'

    b64 = base64.b64encode(f32.tobytes()).decode()
    js = (f'// Generated by tools/weather/fit-geoid.py on {stamp}. Do not edit by hand.\n'
          f'// Geoid undulation N as a spherical-harmonic series (a model constant, not station data).\n'
          f'// Layout: Float32 little-endian, C block (n, 0<=m<=n) then S block (n>=1, 1<=m<=n); {(L + 1) ** 2} values.\n'
          f'// Fit vs 15\' grid: RMS {stats["rms_m"]} m, p99 {stats["p99_m"]} m, max {stats["max_m"]} m.\n'
          f'export const L = {L};\n'
          f'export const source = {json.dumps(source)};\n'
          f'export const coefficientsBase64 =\n')
    js += ''.join(f"  '{b64[i:i + 100]}'{' +' if i + 100 < len(b64) else ';'}\n" for i in range(0, len(b64), 100))
    open(os.path.join(ROOT, 'src/weather/geoid-sh.js'), 'w').write(js)

    vectors = dict(L=L, source=source, stats=stats, points=[
        dict(name=k, lat=POINTS[k][0], lon=POINTS[k][1], series_m=round(series[i], 6), egm2008_m=round(egm[i], 3))
        for i, k in enumerate(names)])
    os.makedirs(os.path.join(ROOT, 'tests/fixtures/weather'), exist_ok=True)
    json.dump(vectors, open(os.path.join(ROOT, 'tests/fixtures/weather/geoid-sh-vectors.json'), 'w'), indent=1)

    print(source)
    print('stats', stats, f'table {len(f32) * 4} bytes, base64 {len(b64)} chars')
    for i, k in enumerate(names):
        print(f'{k:13s} series {series[i]:8.3f}  EGM2008 {egm[i]:8.3f}  diff {series[i] - egm[i]:+6.2f}')


if __name__ == '__main__':
    main()
