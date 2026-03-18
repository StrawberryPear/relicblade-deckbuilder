# Relicblade Deckbuilder Memory

## Project Structure
- `/dist/` - Contains all the distributed files that matter
- Key files: base.js, library.js, menu.js, deck.js, viewer.css, viewerHorizontal.css

## Display Modes
The app has several display modes controlled by document.body attributes:
- `showing`: "library", "deck", "menu" (main app states)
- `displayType`: "", "list", "grid" (library display modes)
- `listType`: "", "list" (list formatting in deck mode)
- `legal`: "", "false" (card legality filter)
- `subFilter`: various filter values
- `className`: "loading", "" (loading states)

## Recent Changes
- **Horizontal Orientation List Mode Prevention**: Implemented comprehensive solution to prevent list modes when in landscape orientation (see horizontal-orientation-listmode-fix.md)
  - CSS hides menu options
  - JavaScript prevents activation
  - Orientation changes auto-reset modes
  - Grid button skips list mode when horizontal

- **Card Name List Styling**: Modified cardNameList to have constrained width and be centered
  - Set max-width: 528px on cardNameList and cardnamelist
  - Centered using margin: 0 auto
  - Added padding for proper spacing in list modes
  - Children inherit from container width instead of viewport width
  - Moved container-type: inline-size from nameCard upper to nameCard for better container query control

- **Add Character Button Styling**: Redesigned the add character button for list mode only
  - Reduced height to 30% of card width in list mode
  - Increased width to 120% of card width for better button appearance
  - Adjusted border radius for flatter appearance
  - Applied cardButton styling to match "show library" and other buttons:
    - Background: url(./assets/add-remove.png) with proper sizing and positioning
    - Text color: #091e21 (dark text on button background)
    - Drop shadow: 2px 4px 6px black
  - Changed "+" from absolutely positioned to flowing inline (later disabled)
  - Used flexbox centering for proper text alignment
  - Added margin above the entire container (15% of card width)
  - All changes apply only to `body[listType="list"]` selector