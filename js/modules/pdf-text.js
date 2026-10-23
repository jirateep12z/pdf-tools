class PdfTextModule {
  async ExtractTextFromFiles(uploaded_files) {
    const text_content = this.FormatExtractedText(
      await this.ExtractTextPages(uploaded_files)
    );
    if (!text_content) {
      throw new Error('ไม่พบข้อความใน PDF นี้');
    }
    return text_content;
  }

  async ExtractTextPages(uploaded_files) {
    if (!uploaded_files || uploaded_files.length === 0) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const text_files = [];
    for (const uploaded_file of uploaded_files) {
      text_files.push({
        file_name: uploaded_file.file_name,
        pages: await this.ExtractPagesFromFile(uploaded_file)
      });
    }
    return text_files;
  }

  FormatExtractedText(text_files) {
    return (text_files || [])
      .map(text_file => {
        const file_text = text_file.pages
          .map(text_page => `Page ${text_page.page_number}\n${text_page.text}`)
          .join('\n\n');
        return `File: ${text_file.file_name}\n\n${file_text}`;
      })
      .join('\n\n---\n\n')
      .trim();
  }

  async ExtractPagesFromFile(uploaded_file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด pdf.js ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
    let pdf_document = null;
    try {
      const loading_task = pdfjsLib.getDocument({
        data: uploaded_file.file_bytes.slice(0)
      });
      pdf_document = await loading_task.promise;
    } catch (error) {
      throw new Error('ไม่สามารถอ่านไฟล์นี้ได้');
    }
    const text_pages = [];
    for (
      let page_number = 1;
      page_number <= pdf_document.numPages;
      page_number += 1
    ) {
      const page = await pdf_document.getPage(page_number);
      const text_content = await page.getTextContent();
      const page_text = this.JoinTextItems(text_content.items);
      if (page_text) {
        text_pages.push({ page_number: page_number, text: page_text });
      }
    }
    return text_pages;
  }

  JoinTextItems(text_items) {
    const raw_text = (text_items || [])
      .map(
        text_item => `${text_item?.str ?? ''}${text_item?.hasEOL ? '\n' : ''}`
      )
      .join('');
    const text_lines = raw_text
      .split('\n')
      .map(text_line => text_line.replace(/[ \t]+/g, ' ').trim());
    const kept_lines = text_lines.filter(
      (text_line, line_index) => text_line || text_lines[line_index - 1]
    );
    return kept_lines.join('\n').trim();
  }
}
