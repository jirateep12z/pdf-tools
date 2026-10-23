# PDF Tools

A browser-based PDF toolkit with ten tools for merging, splitting, organizing, converting, extracting, editing, and compressing PDF files. Files are processed locally in the browser and are never uploaded to a server. Built with vanilla JavaScript, [pdf.js](https://mozilla.github.io/pdf.js/) 6.4.299, [pdf-lib](https://pdf-lib.js.org/) 1.17.1, JSZip 3.10.2, Tailwind CSS, and Lucide icons.

## Features

### Getting Around

- **Tool Overview**: The app opens on an overview of all tools, grouped into Organize, Convert, Extract, Edit, and Optimize
- **Direct Links**: Every tool has its own address, such as `#merge` or `#images-to-pdf`, so links and reloads open the same tool
- **Back Button**: One press of the browser's back button returns from any tool to the overview; the header's **เครื่องมือทั้งหมด** button opens it as well
- **Dark and Light Modes**: Dark mode by default, with a toggle that remembers your choice
- **Thai Interface**: All labels, messages, and help text are in Thai

### Working With Files

- **Drop Anywhere**: Drop files on the center workspace or the upload zone in the left panel; an overlay shows whether the drop selects or replaces files
- **Empty Workspace Guide**: Before any file is loaded, the workspace shows the accepted file types and a **เลือกไฟล์** button
- **Grid and Page Views**: Switch between a card grid and a page-by-page preview with previous/next navigation
- **Long File Names**: Long names stay on one line and keep their end and extension visible; the full name appears on hover

### Organize

- **Merge PDF**: Combine several PDF files into one, reorder them with arrow buttons, and remove files before exporting
- **Split PDF**: Choose pages by typing a range or by selecting page cards, then export them as a new PDF
- **Reorder / Delete / Rotate**: Move, delete (and restore), and rotate individual pages before exporting

### Convert

- **Images To PDF**: Convert JPG, PNG, and WebP images into a PDF, with image cards that show their pixel size and can be reordered

### Extract

- **Extract Text**: Read the text layer of each page in the workspace, copy it all at once, or download it as a `.txt` file; line breaks follow the PDF
- **Extract Images**: Render the selected pages to PNG and download them together as a ZIP archive

### Edit

- **Watermark PDF**: Add text with a preset position plus X/Y offset, color, size, opacity, and rotation around the text center, optionally as a non-overlapping repeating pattern with adjustable X/Y gaps, and on selected pages
- **Add Page Numbers**: Choose the format (`1`, `Page 1`, or `Page 1 of 10`), the position (top or bottom; left, center, or right), the starting number, and the page range
- **Edit / Annotate**: Place text, colored boxes, images, and lines or arrows on pages, with undo/redo and twelve Thai fonts

### Optimize

- **Compress PDF**: Choose Low, Medium (recommended), or High compression
  - Low keeps the document structure and selectable text
  - Medium and High convert pages to images to reduce size
  - A side-by-side comparison shows the original page and a compressed sample with their approximate size per page
  - A warning appears when the sample suggests the file may grow, recommending the Low level
  - Files are limited to 50 MB

### Feedback

- **Live Preview**: With one PDF loaded, Watermark and Add Page Numbers update the page preview as you change their settings
- **Notifications**: Success messages disappear on their own; error messages stay until you close them
- **Busy Indicator**: The workspace shows when files are being prepared or a preview is being rendered

### Progressive Web App

- **Installable App**: Add PDF Tools to supported desktop and mobile home screens
- **Fresh Updates**: App code is checked with the server on each visit, so a new release is picked up without clearing caches
- **Offline App Shell**: After one visit, the app page, scripts, fonts, and icons reopen from the cache when the network is unavailable

## Usage

1. Open the app and pick a tool from the overview, or use the category tabs at the top.
2. Drop files on the workspace or press **เลือกไฟล์**.
3. Adjust the tool's settings in the left panel and check the result in the preview.
4. Press **สร้างและดาวน์โหลด** in the right panel to download the result.

Direct links to each tool:

| Tool                      | Link              |
| ------------------------- | ----------------- |
| Merge PDF                 | `#merge`          |
| Split PDF                 | `#split`          |
| Reorder / Delete / Rotate | `#organize`       |
| Images To PDF             | `#images-to-pdf`  |
| Extract Text              | `#extract-text`   |
| Extract Images            | `#extract-images` |
| Watermark PDF             | `#watermark`      |
| Add Page Numbers          | `#page-numbers`   |
| Edit / Annotate           | `#annotate`       |
| Compress PDF              | `#compress`       |

## Privacy and Limitations

- **Local Processing**: PDF and image files are read and processed in the browser only.
- **CDN Libraries**: pdf.js, pdf-lib, JSZip, Tailwind CSS, and Lucide load from public CDNs, so the first visit needs an internet connection. Processing while offline depends on the browser having kept those libraries in its own cache and is not guaranteed.
- **Text Layer Required**: Extract Text reads existing text; scanned pages without a text layer return no text (there is no OCR).
- **Compression Trade-off**: Medium and High compression turn pages into images, so their text can no longer be selected or searched.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions, issues and feature requests are welcome!

## Show your support

Give a ⭐️ if this project helped you!

## Author

**Made with ❤️ by @jirateep12z**
