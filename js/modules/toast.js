const TOAST_SUCCESS_DURATION_MS = 4000;
const TOAST_MAXIMUM_VISIBLE = 3;

class ToastModule {
  constructor(region_element) {
    this.region_element = region_element;
    this.dismiss_timers = new Map();
    this.return_focus_element = null;
    this.region_element?.addEventListener('focusin', event => {
      const previous_element = event.relatedTarget;
      if (previous_element && !this.region_element.contains(previous_element)) {
        this.return_focus_element = previous_element;
      }
    });
  }

  ShowSuccess(message_text) {
    if (!this.region_element || !message_text) return;
    const toast_element = this.CreateToast('success', message_text);
    this.AddToast(toast_element);
    this.dismiss_timers.set(
      toast_element,
      setTimeout(() => this.Dismiss(toast_element), TOAST_SUCCESS_DURATION_MS)
    );
  }

  ShowError(message_text) {
    if (!this.region_element || !message_text) return;
    const is_duplicate = [
      ...this.region_element.querySelectorAll('.toast-error')
    ].some(
      toast_element =>
        toast_element.querySelector('.toast-message')?.textContent ===
        message_text
    );
    if (is_duplicate) return;
    const toast_element = this.CreateToast('error', message_text);
    const close_button = document.createElement('button');
    close_button.type = 'button';
    close_button.className = 'toast-close';
    close_button.setAttribute('aria-label', 'ปิดการแจ้งเตือน');
    close_button.title = 'ปิดการแจ้งเตือน';
    const close_icon = document.createElement('i');
    close_icon.dataset.lucide = 'x';
    close_button.appendChild(close_icon);
    close_button.addEventListener('click', () => this.Dismiss(toast_element));
    toast_element.appendChild(close_button);
    this.AddToast(toast_element);
  }

  CreateToast(toast_kind, message_text) {
    const is_error = toast_kind === 'error';
    const toast_element = document.createElement('div');
    toast_element.className = `toast toast-${toast_kind}`;
    toast_element.setAttribute('role', is_error ? 'alert' : 'status');
    const icon_element = document.createElement('i');
    icon_element.className = 'toast-icon';
    icon_element.dataset.lucide = is_error ? 'circle-alert' : 'circle-check';
    const message_element = document.createElement('p');
    message_element.className = 'toast-message';
    message_element.textContent = message_text;
    toast_element.append(icon_element, message_element);
    return toast_element;
  }

  AddToast(toast_element) {
    while (this.region_element.children.length >= TOAST_MAXIMUM_VISIBLE) {
      this.Dismiss(this.region_element.firstElementChild);
    }
    this.region_element.appendChild(toast_element);
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  Dismiss(toast_element) {
    if (!toast_element) return;
    clearTimeout(this.dismiss_timers.get(toast_element));
    this.dismiss_timers.delete(toast_element);
    const had_focus = toast_element.contains(document.activeElement);
    const neighbor_close_button =
      toast_element.nextElementSibling?.querySelector('.toast-close') ||
      toast_element.previousElementSibling?.querySelector('.toast-close') ||
      null;
    toast_element.remove();
    if (had_focus) {
      this.RestoreFocus(neighbor_close_button);
    }
  }

  RestoreFocus(preferred_button) {
    if (preferred_button?.isConnected) {
      preferred_button.focus();
      return;
    }
    if (this.return_focus_element?.isConnected) {
      this.return_focus_element.focus();
    }
  }
}
