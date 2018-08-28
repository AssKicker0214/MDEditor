# MDEditor
Markdown Editor, developed with pure HTML5. Support real time preview and code hightlighting. This repo is inspired by 
[marked](https://github.com/markedjs/marked), and is actually use it to render the markdown codes to html.

The reason for developing this repo is that I find it painful when rendering the md code to html elements with `marked` while **keeping their coresponding 
relationship**, i.e. which markdown code block is rendered into which html element. This repo is built upon `marked` and provides a ready-to-use
editor which is able to show real time preview. [hightlight.js](https://github.com/isagalaev/highlight.js) is also put into use for code rendering.

## Warning
MDEditor now only supports limited syntax:

- `Heading` should only starts with several hash symbols `#`
- `table` should be wrapped with `|` in every line
- `code block` should be wrapped with ` ``` `
- `ordered list`

## Dependencies

| dependency | version |
| :---: | :---: |
| jquery | 3.2.1 |
| marked | 0.3.4 |
| highlight.js | 9.12.0 |

## Demo
pass

## Usage
### 1. Refer to dependencies
`style.css` is customized style for html
`tomorrow-night-eighties.css` is one of the themes for `hightlight.js`
``` html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="lib/highlightjs/styles/tomorrow-night-eighties.css">
<script src="lib/jquery/dist/jquery.js"></script>
<script src="lib/marked/marked.min.js"></script>
<script src="lib/highlightjs/highlight.pack.js"></script>
```

### 2. Define your editor and previewer elements
You can use any `id` for your element, just pass them to `Editor` and `Previewer` when initialising.

> ** Please ensure to set `contenteditable='true'` for your editor element**

``` html
<body>
<div id="container">
    <div id="editor" contenteditable="true">
    </div>
    <div id="previewer">
    </div>
</div>

<script src="MDEditor.js"></script>
<script>
    let editor = new Editor('editor');
    let previewer = new Previewer('previewer');
    editor.setPreviewer(previewer);
</script>
</body>
</html>
```
