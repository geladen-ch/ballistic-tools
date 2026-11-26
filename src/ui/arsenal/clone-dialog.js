import { el } from '../../dom.js';
import { t } from '../../i18n.js';
import { showDialog } from '../app-dialog.js';
import { fieldValidity } from '../field-validity.js';
import { isNameTaken } from '../../arsenal-clone.js';

// The Arsenal's Clone modal, shared by "Clone rifle" and "Clone cartridge":
// a heading, one line saying what will be copied, and the new name —
// prefilled with the proposed "<name> (Clone n)" — with Clone and Cancel.
// Clone is refused while the name is blank or already used by one of
// `takenNames` (the other rifles, or the rifle's other cartridges), so a
// clone never lands on, or reads the same as, an existing entry.
// `onClone(name)` gets the trimmed name once the dialog has closed.
export function showCloneDialog({ headingKey, intro, proposedName, takenNames, onClone }) {
  const nameInput = el('input', { type: 'text', id: 'arsenalCloneName', value: proposedName });
  const validity = fieldValidity(nameInput, () => {
    const name = nameInput.value.trim();
    if (!name) return t('arsenal.errorNameRequired');
    if (isNameTaken(name, takenNames)) return t('arsenal.cloneNameTaken');
    return null;
  });

  const body = el('div', { class: 'arsenal-clone-dialog' }, [
    el('h3', { i18n: headingKey }),
    el('p', { text: intro }),
    el('div', { class: 'field' }, [
      el('label', { for: nameInput.id, i18n: 'arsenal.cloneNameLabel' }),
      nameInput,
      validity.hintNode
    ])
  ]);

  showDialog({
    bodyNode: body,
    buttons: [
      {
        label: t('arsenal.cloneConfirmButton'),
        validate: () => validity.validate(),
        onClick: () => onClone(nameInput.value.trim())
      },
      { label: t('arsenal.cancelButton') }
    ]
  });
}
