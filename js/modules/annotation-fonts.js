const ANNOTATION_DEFAULT_FONT_KEY = 'sarabun';

const ANNOTATION_FONT_OPTIONS = [
  {
    key: 'sarabun',
    label: 'Sarabun',
    family: 'Sarabun',
    url: './fonts/Sarabun-Regular.ttf'
  },
  {
    key: 'noto_sans_thai',
    label: 'Noto Sans Thai',
    family: 'Noto Sans Thai',
    url: './fonts/NotoSansThai-Regular.ttf'
  },
  {
    key: 'prompt',
    label: 'Prompt',
    family: 'Prompt',
    url: './fonts/Prompt-Regular.ttf'
  },
  {
    key: 'kanit',
    label: 'Kanit',
    family: 'Kanit',
    url: './fonts/Kanit-Regular.ttf'
  },
  {
    key: 'mitr',
    label: 'Mitr',
    family: 'Mitr',
    url: './fonts/Mitr-Regular.ttf'
  },
  {
    key: 'bai_jamjuree',
    label: 'Bai Jamjuree',
    family: 'Bai Jamjuree',
    url: './fonts/BaiJamjuree-Regular.ttf'
  },
  {
    key: 'chakra_petch',
    label: 'Chakra Petch',
    family: 'Chakra Petch',
    url: './fonts/ChakraPetch-Regular.ttf'
  },
  {
    key: 'pridi',
    label: 'Pridi',
    family: 'Pridi',
    url: './fonts/Pridi-Regular.ttf'
  },
  {
    key: 'taviraj',
    label: 'Taviraj',
    family: 'Taviraj',
    url: './fonts/Taviraj-Regular.ttf'
  },
  {
    key: 'mali',
    label: 'Mali',
    family: 'Mali',
    url: './fonts/Mali-Regular.ttf'
  },
  {
    key: 'itim',
    label: 'Itim',
    family: 'Itim',
    url: './fonts/Itim-Regular.ttf'
  },
  {
    key: 'sriracha',
    label: 'Sriracha',
    family: 'Sriracha',
    url: './fonts/Sriracha-Regular.ttf'
  }
];

const AnnotationFonts = {
  GetOptions() {
    return ANNOTATION_FONT_OPTIONS;
  },

  Resolve(font_key) {
    return (
      ANNOTATION_FONT_OPTIONS.find(
        font_option => font_option.key === font_key
      ) ||
      ANNOTATION_FONT_OPTIONS.find(
        font_option => font_option.key === ANNOTATION_DEFAULT_FONT_KEY
      )
    );
  },

  DefaultKey() {
    return ANNOTATION_DEFAULT_FONT_KEY;
  }
};
