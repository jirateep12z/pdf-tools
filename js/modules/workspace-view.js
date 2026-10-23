const WORKSPACE_VIEW_GRID = 'grid';
const WORKSPACE_VIEW_PAGE = 'page';

class WorkspaceView {
  constructor() {
    this.workspace_element = document.getElementById('pdf-workspace');
    this.grid_elements = [
      ...document.querySelectorAll('[data-workspace-grid]')
    ];
    if (!this.workspace_element || this.grid_elements.length === 0) return;
    this.option_buttons = [
      ...document.querySelectorAll('[data-workspace-view-option]')
    ];
    this.visible_grids = this.FindVisibleGrids();
    this.AttachOptionListeners();
    this.AttachPagePreviewListener();
    this.ObserveGridVisibility();
    this.SetView(WORKSPACE_VIEW_GRID);
  }

  FindVisibleGrids() {
    return new Set(
      this.grid_elements.filter(
        grid_element => !grid_element.classList.contains('hidden')
      )
    );
  }

  AttachOptionListeners() {
    this.option_buttons.forEach(option_button => {
      option_button.addEventListener('click', () => {
        this.SetView(option_button.dataset.workspaceViewOption);
      });
    });
  }

  AttachPagePreviewListener() {
    this.workspace_element.addEventListener('click', event => {
      const preview_button = event.target.closest(
        '[data-workspace-grid] [data-action="preview"]'
      );
      if (!preview_button || preview_button.disabled) return;
      this.SetView(WORKSPACE_VIEW_PAGE);
    });
  }

  ObserveGridVisibility() {
    this.visibility_observer = new MutationObserver(() =>
      this.HandleGridVisibilityChange()
    );
    this.grid_elements.forEach(grid_element => {
      this.visibility_observer.observe(grid_element, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
  }

  HandleGridVisibilityChange() {
    const next_visible_grids = this.FindVisibleGrids();
    const has_newly_visible_grid = [...next_visible_grids].some(
      grid_element => !this.visible_grids.has(grid_element)
    );
    this.visible_grids = next_visible_grids;
    if (has_newly_visible_grid) {
      this.SetView(WORKSPACE_VIEW_GRID);
    }
  }

  SetView(view_name) {
    const next_view =
      view_name === WORKSPACE_VIEW_PAGE
        ? WORKSPACE_VIEW_PAGE
        : WORKSPACE_VIEW_GRID;
    this.workspace_element.dataset.workspaceView = next_view;
    this.option_buttons.forEach(option_button => {
      const is_active = option_button.dataset.workspaceViewOption === next_view;
      option_button.classList.toggle('active', is_active);
      option_button.setAttribute('aria-pressed', String(is_active));
    });
  }
}

function InitializeWorkspaceView() {
  new WorkspaceView();
}

document.addEventListener('DOMContentLoaded', InitializeWorkspaceView);
