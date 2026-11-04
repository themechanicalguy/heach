/**
 * jsdom has no modal dialogs: opening sets `open` and closing clears it and fires `close`, as a
 * browser does, so sheets can be opened and used in component tests.
 */
export function mockDialogs() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
