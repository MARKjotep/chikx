/**
 * One-sentence descriptions for the CSS properties Chikx offers inside rule
 * bodies. Pure data: the extension adapters and the intelligence layer use the
 * same strings for hover and completion documentation.
 */

/**
 * Built-in property documentation keyed by property name.
 *
 * Covers every entry of the completion property list; each value is a single
 * MDN-style sentence (sentence case, trailing period).
 */
export const CSS_PROPERTY_DOCS: Readonly<Record<string, string>> = Object.freeze({
  "accent-color":
    "Sets the accent color used by native form controls such as checkboxes and radios.",
  "align-content":
    "Distributes space between and around content lines along the cross axis of a flex or grid container.",
  "align-items": "Sets the default alignment of flex or grid items along the cross axis.",
  "align-self": "Overrides a flex or grid item's cross-axis alignment set by `align-items`.",
  animation: "Shorthand for applying one or more keyframe animations to an element.",
  "animation-delay":
    "Sets how long an animation waits before it starts; negative values start partway through.",
  "animation-direction":
    "Chooses whether an animation runs forwards, backwards or alternates on each cycle.",
  "animation-duration": "Sets how long one animation cycle takes.",
  "animation-fill-mode": "Chooses which animation values apply before it starts and after it ends.",
  "animation-iteration-count":
    "Sets how many times an animation cycle repeats (`infinite` for endless).",
  "animation-name": "Names the `@keyframes` block an animation runs.",
  "animation-play-state": "Pauses or resumes a running animation (`paused`, `running`).",
  "animation-timing-function":
    "Sets the easing curve applied between an animation's frames (`ease`, `linear`, `steps(4)`).",
  appearance: "Requests native platform styling for a form control, or removes it with `none`.",
  "aspect-ratio": "Sets a preferred width-to-height ratio for a box (`16 / 9`).",
  "backdrop-filter": "Applies graphical filters such as blur to the area behind an element.",
  background:
    "Shorthand for the color, image, position, size and repetition of an element's background.",
  "background-clip":
    "Limits how far an element's background paints, for example to the content box or text.",
  "background-color": "Sets the solid color painted behind an element's content.",
  "background-image": "Sets one or more images or gradients drawn as an element's background.",
  "background-position":
    "Sets the starting position of a background image within its positioning area.",
  "background-size":
    "Sets the rendered size of a background image (`cover`, `contain` or explicit lengths).",
  border: "Shorthand for the width, style and color of all four borders.",
  "border-bottom": "Shorthand for the width, style and color of the bottom border.",
  "border-bottom-color": "Sets the color of the bottom border.",
  "border-collapse":
    "Chooses whether table borders are collapsed into a single shared border or kept separate.",
  "border-color": "Sets the color of all four borders.",
  "border-left": "Shorthand for the width, style and color of the left border.",
  "border-left-color": "Sets the color of the left border.",
  "border-radius": "Rounds the corners of an element's border box.",
  "border-right": "Shorthand for the width, style and color of the right border.",
  "border-right-color": "Sets the color of the right border.",
  "border-style": "Sets the line style (`solid`, `dashed`, `dotted`, …) of all four borders.",
  "border-top": "Shorthand for the width, style and color of the top border.",
  "border-top-color": "Sets the color of the top border.",
  "border-width": "Sets the thickness of all four borders.",
  bottom: "Offsets a positioned element from the bottom edge of its containing block.",
  "box-shadow": "Draws one or more shadows behind an element's box.",
  "box-sizing":
    "Chooses whether width and height include padding and borders (`border-box`) or only content (`content-box`).",
  "caret-color": "Sets the color of the text insertion caret.",
  "clip-path": "Clips an element to a shape such as a circle, polygon or inset rectangle.",
  color: "Sets the foreground text and caret color of an element.",
  "column-gap": "Sets the gap between columns in flex, grid or multi-column layout.",
  "column-rule-color": "Sets the color of the rule drawn between columns of multi-column text.",
  content: "Inserts generated content in `::before` and `::after` pseudo-elements.",
  cursor: "Sets the mouse pointer shown over an element (`pointer`, `grab`, …).",
  display:
    "Chooses the element's outer and inner display type (`block`, `flex`, `grid`, `none`, …).",
  fill: "Sets the color used to paint the inside of an SVG shape.",
  filter: "Applies graphical effects such as blur, brightness or drop shadow to an element.",
  flex: "Shorthand for growing, shrinking and setting the base size of a flex item.",
  "flex-basis": "Sets the initial main size of a flex item before free space is distributed.",
  "flex-direction": "Sets the main axis of a flex container (`row`, `column` and their reverses).",
  "flex-grow": "Sets how much a flex item grows to fill free space relative to its siblings.",
  "flex-shrink": "Sets how much a flex item shrinks when space is insufficient.",
  "flex-wrap": "Chooses whether flex items stay on one line or wrap onto several.",
  float: "Moves an element to the left or right so following content flows around it.",
  font: "Shorthand for the family, size, style, weight and line height of text.",
  "font-family": "Sets a prioritized list of typefaces for text.",
  "font-size": "Sets the size of text.",
  "font-style": "Chooses upright, italic or oblique text.",
  "font-weight": "Sets the boldness of text (`400`, `700`, `bold`, …).",
  gap: "Shorthand for the row and column gaps in flex, grid or multi-column layout.",
  grid: "Shorthand for defining a grid container's rows, columns, areas and auto flow.",
  "grid-area": "Places a grid item into named or explicit rows, columns and areas.",
  "grid-column": "Places a grid item across a span of columns or into one column.",
  "grid-row": "Places a grid item across a span of rows or into one row.",
  "grid-template-areas": "Defines named grid areas as a rectangular grid of names.",
  "grid-template-columns":
    "Defines a grid container's column tracks (`1fr 1fr`, `repeat(3, 1fr)`, …).",
  "grid-template-rows": "Defines a grid container's row tracks.",
  height: "Sets the height of an element's content box.",
  inset: "Shorthand for the top, right, bottom and left offsets of a positioned element.",
  "justify-content":
    "Distributes free space between and around flex or grid items along the main or inline axis.",
  "justify-items": "Sets the default inline-axis alignment of grid items inside their cells.",
  "justify-self": "Overrides one grid item's inline-axis alignment inside its cell.",
  left: "Offsets a positioned element from the left edge of its containing block.",
  "letter-spacing": "Sets extra spacing between characters of text.",
  "line-height": "Sets the height of a line box relative to its text.",
  "list-style": "Shorthand for the marker type, position and image of list items.",
  margin: "Shorthand for the outer spacing on all four sides of an element.",
  "margin-bottom": "Sets the outer spacing below an element.",
  "margin-left": "Sets the outer spacing to the left of an element.",
  "margin-right": "Sets the outer spacing to the right of an element.",
  "margin-top": "Sets the outer spacing above an element.",
  "max-height": "Caps how tall an element may grow.",
  "max-width": "Caps how wide an element may grow.",
  "min-height": "Sets the smallest height an element may shrink to.",
  "min-width": "Sets the smallest width an element may shrink to.",
  "object-fit": "Chooses how a replaced element's content fits its box (`cover`, `contain`, …).",
  opacity: "Sets how transparent an element and its contents are, from `0` to `1`.",
  order: "Reorders a flex or grid item relative to its siblings without changing the source.",
  outline: "Shorthand for a line drawn around an element without affecting layout.",
  "outline-color": "Sets the color of the outline drawn around an element.",
  overflow: "Chooses whether content that overflows a box is clipped or scrollable.",
  "overflow-x": "Chooses whether horizontal overflow is clipped or scrollable.",
  "overflow-y": "Chooses whether vertical overflow is clipped or scrollable.",
  padding: "Shorthand for the inner spacing on all four sides of an element.",
  "padding-bottom": "Sets the inner spacing below an element's content.",
  "padding-left": "Sets the inner spacing to the left of an element's content.",
  "padding-right": "Sets the inner spacing to the right of an element's content.",
  "padding-top": "Sets the inner spacing above an element's content.",
  "place-items": "Shorthand for `align-items` and `justify-items` in a grid or flex container.",
  "pointer-events":
    "Chooses whether an element responds to pointer input, or lets events pass through (`none`).",
  position:
    "Chooses how an element is positioned (`static`, `relative`, `absolute`, `fixed`, `sticky`).",
  resize: "Chooses whether a user may resize an element and along which axes.",
  right: "Offsets a positioned element from the right edge of its containing block.",
  "row-gap": "Sets the gap between rows in flex, grid or multi-column layout.",
  "scroll-behavior": "Chooses whether programmatic scrolling is smooth or instant.",
  stroke: "Sets the color used to paint the outline of an SVG shape.",
  "text-align":
    "Aligns inline content horizontally inside its line box (`left`, `center`, `right`, `justify`).",
  "text-decoration":
    "Shorthand for underlines, overlines, line-throughs and their color and style.",
  "text-decoration-color": "Sets the color of the lines drawn by `text-decoration`.",
  "text-overflow":
    "Chooses how clipped overflowing single-line text is marked (`ellipsis`, `clip`).",
  "text-transform": "Changes the capitalization of text (`uppercase`, `lowercase`, `capitalize`).",
  top: "Offsets a positioned element from the top edge of its containing block.",
  transform: "Applies translation, rotation, scaling or skewing to an element.",
  transition: "Shorthand for animating property changes over time with easing and delay.",
  "user-select": "Chooses whether text in an element can be selected by the user.",
  "vertical-align": "Sets the vertical alignment of inline, inline-block or table-cell boxes.",
  visibility: "Shows or hides an element while keeping its layout space (`hidden`).",
  "white-space":
    "Chooses how white space and line wrapping are handled (`nowrap`, `pre`, `pre-wrap`, …).",
  width: "Sets the width of an element's content box.",
  "word-break":
    "Chooses where to break words that would otherwise overflow (`break-all`, `keep-all`).",
  "z-index": "Stacks a positioned element relative to its siblings along the z axis.",
});

/**
 * Description for one CSS property name.
 *
 * Returns `undefined` for unknown names so callers can skip hover or leave
 * completion documentation empty.
 */
export function propertyDoc(name: string): string | undefined {
  return Object.hasOwn(CSS_PROPERTY_DOCS, name) ? CSS_PROPERTY_DOCS[name] : undefined;
}
