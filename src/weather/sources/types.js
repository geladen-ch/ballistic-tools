// Type definitions shared by sources and core (JSDoc only). No runtime code. SI throughout: angles in radians,
// lengths in metres, pressures in pascal, humidity a fraction, durations in seconds, temperatures in °C.

/**
 * @typedef {Object} Station
 * @property {string} id
 * @property {string} name
 * @property {number} latRad
 * @property {number} lonRad
 * @property {number|null} elevM        station elevation, m a.s.l. (temperature sensor reference)
 * @property {number|null} [barometerM] barometer height, m a.s.l., when the source gives it
 * @property {number} distanceM
 * @property {string} [network]
 * @property {StationIds} [ids]         identifiers for matching the same station across feeds
 */

/**
 * @typedef {Object} StationIds
 * @property {string[]} [wigos]   all WIGOS ids known for the site (aliases), e.g. ['0-756-0-660', '0-20000-0-06660']
 * @property {string|null} [wmo]  WMO index, e.g. '06660'
 * @property {string|null} [icao] ICAO location indicator (METAR)
 */

/**
 * Station metadata returned by `stations()` (step 1 of the two-step interface). The core adds `distanceM` (from the
 * device) and may override `elevM`/`barometerM` from an authoritative list of another source (`elevFrom` then holds the
 * previous values) before passing the entries to `current()`.
 * @typedef {Object} StationMeta
 * @property {string} sourceId
 * @property {string} id
 * @property {string} name
 * @property {number} latRad
 * @property {number} lonRad
 * @property {number|null} elevM           station elevation (temperature reference), m a.s.l.
 * @property {number|null} [barometerM]    barometer height, m a.s.l.
 * @property {StationIds} [ids]
 * @property {string} [network]
 * @property {number} [distanceM]
 * @property {{sourceId:string, id:string, elevM:number|null, barometerM:number|null}} [elevFrom]
 */

/**
 * A note is a code with parameters; the UI translates it (`onlineWeather.note.<code>`).
 * @typedef {{code:string, [param:string]:any}} Note
 */

/**
 * @typedef {Object} Observation
 * @property {string} sourceId
 * @property {'METAR'|'SYNOP'|string} [reportType]   kind of report; used to match the same site across feeds
 * @property {string} attribution                   the provider's prescribed credit line
 * @property {Station} station
 * @property {Date} time                            observation time (UTC)
 * @property {number|null} temperatureC
 * @property {number|null} dewpointC
 * @property {number|null} humidity                 fraction 0..1; measured if the source gives it, else derived from T/Td
 * @property {{kind:'qnh'|'station'|'mslp', pa:number, reportedPa?:number, adjustPa?:number}|null} pressure
 *   pa is the value used; reportedPa/adjustPa are set when the source value was corrected (Q-group QNH +50 Pa)
 * @property {number|null} cloudFraction          total cloud cover of the report, fraction 0..1; null when the report has none
 * @property {string|null} raw                      e.g. raw METAR
 * @property {Note[]} notes
 * @property {string[]} [qc]   machine-readable data-check outcomes, e.g. 'pressureInconsistent', 'pressureOutOfRange'
 * @property {{tC?:number}} [precision]   reporting resolution in °C (METAR whole °C unless a T group): de-duplication ties
 * @property {boolean} [stale]
 * @property {{t?:object, p?:object, rh?:object}} [skip]   set by markDuplicates(): quantities this report must not
 *                                                         contribute, with the reason (a Note-like object)
 */

/**
 * @typedef {Object} SourceContext
 * @property {(url:string, o?:{signal?:AbortSignal, timeoutMs?:number, headers?:Record<string,string>}) => Promise<any>} getJSON
 * @property {(url:string, o?:object) => Promise<string>} getText
 * @property {{get(key:string):Promise<any>, set(key:string, val:any, ttlS:number):Promise<void>, info(key:string):Promise<{storedAt:number}|null>, delete(key:string):Promise<void>}} cache
 * @property {AbortSignal} [signal]
 * @property {() => Date} [now]
 * @property {(msg:{code:string, [param:string]:any}) => void} [onProgress]   progress message as a code with parameters
 */

/**
 * @typedef {Object} SourceAdapter
 * @property {string} id
 * @property {string} name
 * @property {string} attribution                 the provider's prescribed credit line
 * @property {string} homepage
 * @property {{text:string, url?:string, links?:{text:string,url:string}[], processed?:string}} [credits]   full credit
 *           line; `processed`: note required next to results derived from this source (e.g. DWD)
 * @property {{url:string}} probe                 smallest CORS-readable URL that proves the service answers
 * @property {{kind:'global'}|{kind:'bbox', bbox:number[]}|{kind:'region', polygons:number[][][]}} coverage   radians
 * @property {boolean} [autoDefault]              passed validation; false → Off by default
 * @property {boolean} [authoritativeMetadata]    surveyed heights that override other feeds
 * @property {number} minRefreshS
 * @property {number} nominalIntervalS
 * @property {number} [typicalDelayS]
 * @property {number} [maxStationsPerRefresh]
 * @property {(area:{latRad:number, lonRad:number, radiusM:number}, ctx:SourceContext) => Promise<StationMeta[]>} stations
 *           step 1: metadata in the circle (cached lists)
 * @property {(stations:StationMeta[], ctx:SourceContext, o:{maxAgeS:number}) => Promise<Observation[]>} current
 *           step 2: reports of the selected stations, any age (the core filters)
 * @property {(stationId:string, ctx:SourceContext) => Promise<Date[]>} [recentTimes]   observation times of the station's last
 *           hours, for learning its reporting interval (one small request; the caller asks at most once per station)
 * @property {(ctx:SourceContext) => Promise<number[]|null>} [extent]   learned station extent (radians), from the cached list
 * @property {(point, opts, ctx) => Promise<Observation[]>} [nearest]   this source alone (common.js nearestVia)
 */
export {};
