const ANNOTATION_MAX_HISTORY = 50;

class AnnotationStore {
  constructor() {
    this.pages = {};
    this.undo_stack = [];
    this.redo_stack = [];
    this.id_counter = 0;
  }

  Reset() {
    this.pages = {};
    this.undo_stack = [];
    this.redo_stack = [];
    this.id_counter = 0;
  }

  GenerateId() {
    this.id_counter += 1;
    return `el_${this.id_counter}`;
  }

  Clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  GetElements(page_index) {
    return this.pages[page_index] || [];
  }

  GetAllPages() {
    return this.Clone(this.pages);
  }

  PushHistory() {
    this.undo_stack.push(this.Clone(this.pages));
    if (this.undo_stack.length > ANNOTATION_MAX_HISTORY) {
      this.undo_stack.shift();
    }
    this.redo_stack = [];
  }

  AddElement(page_index, element) {
    this.PushHistory();
    const new_element = { ...element };
    if (!new_element.id) {
      new_element.id = this.GenerateId();
    }
    if (!this.pages[page_index]) {
      this.pages[page_index] = [];
    }
    this.pages[page_index].push(new_element);
    return new_element;
  }

  UpdateElement(page_index, element_id, patch) {
    const elements = this.pages[page_index];
    if (!elements) return null;
    const index = elements.findIndex(item => item.id === element_id);
    if (index < 0) return null;
    this.PushHistory();
    elements[index] = { ...elements[index], ...patch };
    return elements[index];
  }

  DeleteElement(page_index, element_id) {
    const elements = this.pages[page_index];
    if (!elements) return false;
    const index = elements.findIndex(item => item.id === element_id);
    if (index < 0) return false;
    this.PushHistory();
    elements.splice(index, 1);
    if (elements.length === 0) {
      delete this.pages[page_index];
    }
    return true;
  }

  MoveElement(page_index, element_id, direction) {
    const elements = this.pages[page_index];
    if (!elements) return false;
    const index = elements.findIndex(item => item.id === element_id);
    if (index < 0) return false;
    const target_index = direction === 'forward' ? index + 1 : index - 1;
    if (target_index < 0 || target_index >= elements.length) return false;
    this.PushHistory();
    const [moved] = elements.splice(index, 1);
    elements.splice(target_index, 0, moved);
    return true;
  }

  Undo() {
    if (this.undo_stack.length === 0) return false;
    this.redo_stack.push(this.Clone(this.pages));
    this.pages = this.undo_stack.pop();
    return true;
  }

  Redo() {
    if (this.redo_stack.length === 0) return false;
    this.undo_stack.push(this.Clone(this.pages));
    this.pages = this.redo_stack.pop();
    return true;
  }
}
