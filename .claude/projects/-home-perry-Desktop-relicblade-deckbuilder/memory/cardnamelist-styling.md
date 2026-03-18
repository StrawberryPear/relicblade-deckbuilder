# Card Name List Styling Changes

## Problem
User wanted to modify the cardNameList to:
1. Have a max width of 528px
2. Make all children inherit from that width instead of using viewport width
3. Center the cardNameList within the screen

## Implementation

### 1. Container Constraints
Added CSS rules for both `cardNameList` and `cardnamelist` (there are both camelCase and lowercase versions):

```css
cardNameList {
  max-width: 528px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

cardnamelist {
  max-width: 528px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
```

### 2. Child Element Inheritance
- `nameCard` elements already use `width: 100%`, so they inherit from the constrained parent
- Container query units (cqi) used in child elements automatically scale to the new container width
- No changes needed to nameCard width since it inherits properly

### 3. List Mode Padding
Added padding for proper spacing in list modes:

```css
body[displayType="list"] cardScroller.library cardNameList {
  padding: 0 16px;
}

body[listType="list"] cardScroller.deck cardNameList {
  padding: 0 16px;
}
```

### 4. Container Query Context
Moved `container-type: inline-size` from `nameCard upper` to `nameCard`:
```css
nameCard {
  container-type: inline-size; /* moved from nameCard upper */
}
```
This allows container query units (cqi) to be based on the nameCard element's width instead of just the upper element.

### 5. nameCard Padding Consolidation
Simplified the padding declaration:
```css
nameCard {
  padding: 6px 48px 0 48px;
  padding-right: 0px; /* maintained original override */
}
```

## Key Features
✅ **Max width constraint**: 528px maximum width
✅ **Centered layout**: Uses `margin: 0 auto` for centering
✅ **Responsive**: Maintains full width on smaller screens
✅ **Container query compatibility**: Child elements scale with container
✅ **List mode support**: Proper padding in both library and deck list modes
✅ **Cross-browser**: Uses standard CSS properties