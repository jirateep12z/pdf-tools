const FILE_NAME_TAIL_GRAPHEME_COUNT = 8;
const FILE_NAME_EXTENSION_MAX_GRAPHEMES = 10;

class FileNameDisplayModule {
  constructor() {
    this.grapheme_segmenter = null;
  }

  SplitGraphemes(text) {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
      return Array.from(text);
    }
    if (!this.grapheme_segmenter) {
      this.grapheme_segmenter = new Intl.Segmenter(undefined, {
        granularity: 'grapheme'
      });
    }
    return Array.from(
      this.grapheme_segmenter.segment(text),
      segment_data => segment_data.segment
    );
  }

  ReadExtension(file_name) {
    const dot_index = file_name.lastIndexOf('.');
    if (dot_index <= 0) return '';
    const extension_text = file_name.slice(dot_index);
    return this.SplitGraphemes(extension_text).length <=
      FILE_NAME_EXTENSION_MAX_GRAPHEMES
      ? extension_text
      : '';
  }

  SplitFileName(file_name) {
    if (typeof file_name !== 'string' || file_name === '') {
      return { head_text: '', tail_text: '' };
    }
    const extension_text = this.ReadExtension(file_name);
    const base_graphemes = this.SplitGraphemes(
      file_name.slice(0, file_name.length - extension_text.length)
    );
    if (base_graphemes.length <= FILE_NAME_TAIL_GRAPHEME_COUNT) {
      return { head_text: '', tail_text: file_name };
    }
    const head_grapheme_count =
      base_graphemes.length - FILE_NAME_TAIL_GRAPHEME_COUNT;
    return {
      head_text: base_graphemes.slice(0, head_grapheme_count).join(''),
      tail_text:
        base_graphemes.slice(head_grapheme_count).join('') + extension_text
    };
  }

  CreateFileNameElement(file_name) {
    const { head_text, tail_text } = this.SplitFileName(file_name);
    const name_element = document.createElement('span');
    name_element.className = 'file-name';
    name_element.title = typeof file_name === 'string' ? file_name : '';
    const head_element = document.createElement('span');
    head_element.className = 'file-name-head';
    head_element.textContent = head_text;
    const tail_element = document.createElement('span');
    tail_element.className = 'file-name-tail';
    tail_element.textContent = tail_text;
    name_element.append(head_element, tail_element);
    return name_element;
  }
}
