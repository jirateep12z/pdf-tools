const PDF_MIME_TYPE = 'application/pdf';
const TEXT_MIME_TYPE = 'text/plain;charset=utf-8';
const DOWNLOAD_URL_REVOKE_DELAY_MS = 1000;

class PdfDownloadModule {
  constructor() {
    this.current_download_url = null;
  }

  CreateDownloadUrl(file_bytes) {
    this.RevokeCurrentDownloadUrl();
    const pdf_blob = new Blob([file_bytes], { type: PDF_MIME_TYPE });
    this.current_download_url = URL.createObjectURL(pdf_blob);
    return this.current_download_url;
  }

  DownloadBytes(file_bytes, file_name) {
    const download_url = this.CreateDownloadUrl(file_bytes);
    const link_element = document.createElement('a');
    link_element.href = download_url;
    link_element.download = file_name;
    link_element.click();
    window.setTimeout(() => {
      this.RevokeCurrentDownloadUrl();
    }, DOWNLOAD_URL_REVOKE_DELAY_MS);
  }

  DownloadText(text_content, file_name) {
    this.RevokeCurrentDownloadUrl();
    const text_blob = new Blob([text_content], { type: TEXT_MIME_TYPE });
    this.current_download_url = URL.createObjectURL(text_blob);
    const link_element = document.createElement('a');
    link_element.href = this.current_download_url;
    link_element.download = file_name;
    link_element.click();
    window.setTimeout(() => {
      this.RevokeCurrentDownloadUrl();
    }, DOWNLOAD_URL_REVOKE_DELAY_MS);
  }

  async DownloadZipFiles(zip_files, file_name) {
    if (typeof JSZip === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด JSZip ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
    this.RevokeCurrentDownloadUrl();
    const zip = new JSZip();
    zip_files.forEach(zip_file => {
      zip.file(zip_file.file_name, zip_file.file_blob);
    });
    const zip_blob = await zip.generateAsync({ type: 'blob' });
    this.current_download_url = URL.createObjectURL(zip_blob);
    const link_element = document.createElement('a');
    link_element.href = this.current_download_url;
    link_element.download = file_name;
    link_element.click();
    window.setTimeout(() => {
      this.RevokeCurrentDownloadUrl();
    }, DOWNLOAD_URL_REVOKE_DELAY_MS);
  }

  RevokeCurrentDownloadUrl() {
    if (!this.current_download_url) {
      return;
    }
    URL.revokeObjectURL(this.current_download_url);
    this.current_download_url = null;
  }
}
