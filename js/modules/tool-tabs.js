const TOOL_TAB_ACTIVE_CLASS = 'active';
const TOOL_TAB_HIDDEN_CLASS = 'hidden';

class ToolTabs {
  constructor() {
    this.category_tabs = [
      ...document.querySelectorAll('[data-tool-category-tab]')
    ];
    if (this.category_tabs.length === 0) return;
    this.category_panels = [
      ...document.querySelectorAll('[data-tool-category-panel]')
    ];
    this.tool_buttons = [
      ...document.querySelectorAll('[data-pdf-tool][data-tool-category]')
    ];
    this.last_tool_by_category = new Map();
    this.tool_buttons.forEach(tool_button => {
      const tool_category = tool_button.dataset.toolCategory;
      if (!this.last_tool_by_category.has(tool_category)) {
        this.last_tool_by_category.set(
          tool_category,
          tool_button.dataset.pdfTool
        );
      }
    });
    this.AttachCategoryListeners();
    this.ObserveToolSelection();
    this.SyncWithActiveTool();
  }

  AttachCategoryListeners() {
    this.category_tabs.forEach(category_tab => {
      category_tab.addEventListener('click', () => {
        this.SelectCategory(category_tab.dataset.toolCategoryTab);
      });
    });
  }

  SelectCategory(tool_category) {
    const remembered_tool = this.last_tool_by_category.get(tool_category);
    const target_button =
      this.FindToolButton(remembered_tool) ||
      this.tool_buttons.find(
        tool_button => tool_button.dataset.toolCategory === tool_category
      );
    target_button?.click();
  }

  FindToolButton(tool_key) {
    return this.tool_buttons.find(
      tool_button => tool_button.dataset.pdfTool === tool_key
    );
  }

  CountToolsInCategory(tool_category) {
    return this.tool_buttons.filter(
      tool_button => tool_button.dataset.toolCategory === tool_category
    ).length;
  }

  ObserveToolSelection() {
    this.selection_observer = new MutationObserver(() =>
      this.SyncWithActiveTool()
    );
    this.tool_buttons.forEach(tool_button => {
      this.selection_observer.observe(tool_button, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
  }

  SyncWithActiveTool() {
    const active_button = this.tool_buttons.find(tool_button =>
      tool_button.classList.contains(TOOL_TAB_ACTIVE_CLASS)
    );
    if (!active_button) {
      this.tool_buttons.forEach(tool_button =>
        tool_button.setAttribute('aria-pressed', 'false')
      );
      this.category_tabs.forEach(category_tab => {
        category_tab.classList.remove(TOOL_TAB_ACTIVE_CLASS);
        category_tab.setAttribute('aria-pressed', 'false');
      });
      this.category_panels.forEach(category_panel =>
        category_panel.classList.add(TOOL_TAB_HIDDEN_CLASS)
      );
      return;
    }
    const active_category = active_button.dataset.toolCategory;
    this.last_tool_by_category.set(
      active_category,
      active_button.dataset.pdfTool
    );
    this.tool_buttons.forEach(tool_button => {
      tool_button.setAttribute(
        'aria-pressed',
        String(tool_button === active_button)
      );
    });
    this.category_tabs.forEach(category_tab => {
      const is_active_category =
        category_tab.dataset.toolCategoryTab === active_category;
      category_tab.classList.toggle(TOOL_TAB_ACTIVE_CLASS, is_active_category);
      category_tab.setAttribute('aria-pressed', String(is_active_category));
    });
    this.category_panels.forEach(category_panel => {
      const panel_category = category_panel.dataset.toolCategoryPanel;
      const is_visible =
        panel_category === active_category &&
        this.CountToolsInCategory(panel_category) > 1;
      category_panel.classList.toggle(TOOL_TAB_HIDDEN_CLASS, !is_visible);
    });
  }
}

function InitializeToolTabs() {
  new ToolTabs();
}

document.addEventListener('DOMContentLoaded', InitializeToolTabs);
