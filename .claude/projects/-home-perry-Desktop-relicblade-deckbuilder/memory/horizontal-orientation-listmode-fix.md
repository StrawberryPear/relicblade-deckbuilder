# Horizontal Orientation List Mode Prevention

## Problem
User wanted to prevent list modes (`listType="list"` and `displayType="list"`) from being available or active when the screen orientation is horizontal (landscape).

## Implementation

### 1. CSS Changes (viewerHorizontal.css)
- Added CSS rules to hide list mode menu options in landscape orientation:
```css
@media (orientation: landscape) {
  /* Hide list mode menu options in horizontal orientation */
  menuControl.showList,
  menuControl.showCards {
    display: none !important;
  }
```

### 2. JavaScript Changes

#### menu.js
- Modified `showListEle` click handler to check orientation before allowing list mode
- Uses `window.matchMedia('(orientation: landscape)').matches` to detect horizontal orientation

#### library.js
- Modified grid button click handler to skip "list" mode when cycling display types in horizontal orientation
- Changes the cycle from `grid → list → default` to `grid → default` when horizontal

#### base.js
- **Initialization**: Prevent loading list modes from storage when app starts in horizontal orientation
- **onResize handler**: Reset any active list modes when rotating to horizontal orientation
- Automatically switches `displayType="list"` to `displayType=""`
- Automatically switches `listType="list"` to `listType=""`
- Updates stored preferences to match

## Key Features
- Menu options are hidden via CSS in horizontal mode
- JavaScript prevents list modes from being activated
- Orientation changes automatically reset list modes
- Grid button skips list mode when horizontal
- Storage preferences are updated when modes are reset
- Works on both initial load and runtime orientation changes