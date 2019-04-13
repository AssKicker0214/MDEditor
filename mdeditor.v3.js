const BLOCK_REG = {
    /* multi-line components */
    codeblock: {
        start: /^```([\s.]*)/,
        end: /^```\s*/
    },
    list: {
        start: /^(\d+\.|\*|-) .*/,
        end: /^$/
    },
    table: {
        start: /\|([^\|]+\|)+/,
        end: /^$/
    },
    blockquote: {
        start: /^> .*/,
        end: /^$/
    },

    /* single-line components*/
    heading: {
        start: /^(#+) (.+)/,
        end: /^(#+) (.+)/
    },
    splitter: {
        start: /^(-){3,}$/,
        end: /^(-){3,}$/
    },
    image: {
        start: /^!\[(.*)]\((.*)\)(?:x(\d+)%)?/,
        end: /^!\[(.*)]\((.*)\)(?:x(\d+)%)?/
    },
    uploading: {
        start: /^~\[([^\[^\]^\n]*)\]\((\w*)\)/,
        end: /^~\[([^\[^\]^\n]*)\]\((\d*)\)/
    }
};

// inline
const INLINE_REG = {
    bold: /\*\*([^*^\n]+)\*\*/g,
    italy: /\*([^*^\n]+)\*/g,
    code: /`([^`^\n]*)`/g,
    link: /\[(.\[^\[^\]]*)\]\((.*)\)/g
}

class Wrapper {

    constructor(idx) {
        this.idx = idx;         // idx is incremental, but not continuous
        this.closed = false;
        this.name = 'abstract'
    }

    appendable() {
        return false;
    }

    close() {
        this.closed = true;
    }

    parseInlineElems(content) {
        return content.replace(INLINE_REG.bold, "<b>$1</b>").replace(INLINE_REG.italy, "<i>$1</i>").replace(INLINE_REG.code, "<code>$1</code>").replace(INLINE_REG.link, "<a href='$2'>$1</a>")
    }
}

class ParagraphWrapper extends Wrapper {
    constructor(idx, content) {
        super(idx);
        this.content = content;
        this.name = "paragraph";
    }

    appendRaw(ctnt) {
        this.content += ctnt;
    }

    appendable() {
        return true;
    }

    parse() {
        return this.content.trim() !== '' ? `<p class="md-preview-paragraph">${super.parseInlineElems(this.content)}</p>` : '';
    }
}

class CodeBlockWrapper extends Wrapper {
    constructor(idx, type) {
        super(idx);
        this.lines = [];
        this.name = 'codeblock'
        this.type = type ? type : null;
    }

    appendable() {
        return false;
    }

    appendRaw(line) {
        this.lines.push(line)
    }

    parseInlineElems() {
        // Would not parse anything in code blocks
    }

    parse() {
        const pre = hljs.highlightAuto(this.lines.join('\n')).value;
        return `<pre class="md-pre-codeblock" id="p-${this.idx}">${pre}</pre>`
    }
}

// todo 嵌套列表
class ListWrapper extends Wrapper {
    constructor(idx, firstItem, ordered) {
        super(idx);
        this.name = "list";
        this.ordered = !!ordered;
        this.items = [];
        this.appendRaw(firstItem);
    }

    appendable() {
        return true;
    }

    appendRaw(raw) {
        const start = raw.indexOf(' ') + 1;
        this.items.push(raw.substring(start).trim());
    }

    parse() {
        let lis = this.items.map(i => `<li>${i}</li>`).join('\n');
        return this.ordered ? `<ol id=p-"${this.idx}">${lis}</ol>` : `<ul id="p-${this.idx}">${lis}</ul>`
    }
}

class TableWrapper extends Wrapper {
    constructor(idx, rawHeader) {
        super(idx);
        this.name = "table";
        this.rows = [];
        this.aligns = null;
        this.appendRaw(rawHeader);

    }

    appendable() {
        return true;
    }

    appendRaw(raw) {
        console.log(raw);
        let line = raw.trim();
        if (line[0] === '|') line = line.substring(1);
        if (line[line.length - 1] === '|') line = line.substring(0, line.length - 1);
        let cells = this.fit(
            line.trim().split("|").map(col => col.trim())
        );

        if (this.aligns === null && cells.every(c => /[\-:]{3,}/.test(c))) {
            this.aligns = cells.map(c => {
                if (c[0] === ':' && c[c.length - 1] === ':') {
                    return 'center';
                } else if (c[0] === ':') {
                    return 'left';
                } else if (c[c.length - 1] === ':') {
                    return 'right';
                } else {
                    return 'center';
                }
            })
        } else {
            this.rows.push(cells);
        }
    }

    // private
    fit(cols) {
        if (this.rows.length === 0) return cols;

        const r_c = this.rows[0].length - cols.length;
        if (r_c === 0) return cols;
        if (r_c > 0) return cols.concat(new Array(r_c).map(() => ''));
        if (r_c < 0) return cols.splice(0, this.rows[0].length);
    }

    parse() {
        let rows = [];
        rows.push("<tr>\n" + this.rows[0].map(cell => `<th>${cell}</th>`).join('\n') + "</tr>");
        for (let i = 1; i < this.rows.length; i++) {
            rows.push(
                "<tr>\n" +
                this.rows[i].map(cell => `<td>${cell}</td>`).join('\n') +
                "</tr>"
            )
        }

        return `<table id="p-${this.idx}">
                    <thead>${rows.shift()}</thead>
                    <tbody>${rows.join('\n')}</tbody>
                </table>`
    }

}

class BlockquoteWrapper extends Wrapper {
    constructor(idx, firstLine) {
        super(idx);
        this.name = "blockquote";
        this.buff = [];
        this.appendRaw(firstLine);
    }

    appendable() {
        return true;
    }

    appendRaw(raw) {
        if (raw.length >= 2 && raw[0] === '>' && raw[1] === ' ') this.buff.push(raw.substring(2));
        else this.buff[this.buff.length - 1] += raw.trim();
    }

    parse() {
        return `<blockquote class="md-pre-blockquote" id="${this.idx}">${this.buff.join('<br />').trim()}</blockquote>`
    }

}

class HeadingWrapper extends Wrapper {
    constructor(idx, level, text) {
        super(idx);
        this.name = "heading";
        this.level = level;
        this.text = text;
    }

    appendable() {
        return false;
    }

    parse() {
        return `<h${this.level} class="md-pre-heading" id="p-${this.idx}">${this.text}</h${this.level}>`
    }
}

class SplitterWrapper extends Wrapper {
    constructor(idx, token) {
        super(idx);
        this.name = "splitter";
        this.height = token.length - 2;
    }

    appendable() {
        return false;
    }

    parse() {
        return `<hr class="md-pre-splitter" id="p-${this.idx}" />`
    }
}

class ImageWrapper extends Wrapper {
    constructor(idx, alt, src, resize) {
        super(idx);
        this.name = "image";
        this.alt = alt;
        this.src = src;
        this.resize = parseInt(resize) || 90;
    }

    appendable() {
        return false;
    }

    parse() {
        return `<img id="p-${this.idx}" 
style="width: ${this.resize}%;margin: 5px ${(100 - this.resize) / 2}%" 
class="md-pre-image" alt="${this.alt}" 
    src="${this.src}">`
    }
}

class UploadingWrapper extends Wrapper {
    constructor(idx, filename, size) {
        super(idx);
        this.name = "uploading";

        this.filename = filename ? filename : ""
        const units = ['Byte', 'KB', 'MB', 'GB'];
        let i = 0,
            filesize = size;
        while (filesize > 1024) {
            i++;
            filesize /= 1024;
        }
        this.filesize = size ? `${filesize.toFixed(2)} ${units[i]}` : ""
    }

    appendable() {
        return false;
    }

    parse() {
        return `<div class="md-pre-uploading">
        <span>Uploading</span>
        ${this.filename} ${this.filesize}</div>`
    }
}

function dispatch(lines) {
    let page = {
        // elems: [new ParagraphWrapper(null, "")],
        elems: [],
        none: {
            name: 'none',
            closed: true,
            close: () => {
            }
        },
        lastWrapper: function () {
            if (this.elems.length === 0) return this.none;
            let last = this.elems[this.elems.length - 1];
            return last.closed ? this.none : last;
        },
        push: function (wrapper) {
            this.elems.push(wrapper);
        },
        close: function (name) {
            // console.log("closing " + name)
            if (this.lastWrapper().name === 'none') {
                // pass
            } else if (name === 'any' || name === this.lastWrapper().name) {
                this.lastWrapper().close();
            } else {
                console.warn(`Atempt to close ${name}, but last element is ${this.lastWrapper().name}`);
            }
        },
        parseAll: function () {
            return this.elems.map(wrapper => wrapper.parse()).filter(es => es.trim() !== '').join('\n')
        }
    };
    lines.forEach((line, idx) => {
        if ((page.lastWrapper().name !== 'codeblock' && page.lastWrapper().closed === true) &&
            BLOCK_REG.codeblock.start.test(line)) {
            // code block
            const type = line.match(BLOCK_REG.codeblock.start)[1];
            page.push(new CodeBlockWrapper(idx, type))
        } else if (page.lastWrapper().name === 'codeblock' &&
            page.lastWrapper().closed === false &&
            BLOCK_REG.codeblock.end.test(line)) {
            // 
            page.close('codeblock');
        } else if (page.lastWrapper().name === 'codeblock' &&
            page.lastWrapper().closed === false) {
            page.lastWrapper().appendRaw(line);

        } else if (BLOCK_REG.list.start.test(line)) {
            // list block
            if (page.lastWrapper().name === 'list' && !page.lastWrapper().closed) {
                page.lastWrapper().appendRaw(line);
            } else {
                let token = line.match(BLOCK_REG.list.start)[1];
                let ordered = !['*', '-'].includes(token);
                page.push(new ListWrapper(idx, line, ordered));
            }
        } else if (BLOCK_REG.list.end.test(line)) {
            page.close('any')
        } else if (BLOCK_REG.table.start.test(line)) {
            // table block
            if (page.lastWrapper().name === 'table' && !page.lastWrapper().closed) {
                page.lastWrapper().appendRaw(line);
            } else {
                page.push(new TableWrapper(idx, line));
            }
        } else if (BLOCK_REG.table.end.test(line)) {
            page.close('any');
        } else if (BLOCK_REG.blockquote.start.test(line)) {
            // blockquote
            if (page.lastWrapper().name === 'blockquote' && !page.lastWrapper().closed) {
                page.lastWrapper().appendRaw(line);
            } else {
                page.push(new BlockquoteWrapper(idx, line))
            }
        } else if (BLOCK_REG.blockquote.end.test(line)) {
            page.close('any')
        } else if (BLOCK_REG.heading.start.test(line)) {
            // heading
            let matcher = line.match(BLOCK_REG.heading.start)
            page.push(new HeadingWrapper(
                idx,
                matcher[1].length,
                matcher[2]
            ));
            page.close('heading');
        } else if (BLOCK_REG.splitter.start.test(line)) {
            // splitter
            page.push(new SplitterWrapper(idx, line.trim()));
            page.close('splitter');
        } else if (BLOCK_REG.image.start.test(line)) {
            // image
            let matcher = line.match(BLOCK_REG.image.start);
            page.push(new ImageWrapper(idx, matcher[1], matcher[2], matcher[3]));
            page.close('image');
        } else if (BLOCK_REG.uploading.start.test(line)) {
            let matcher = line.match(BLOCK_REG.uploading.start);
            page.push(new UploadingWrapper(idx, matcher[1], matcher[2]));
            page.close('uploading');
        } else {  // paragraph start
            if (['paragraph', 'blockquote'].includes(page.lastWrapper().name) && !page.lastWrapper().closed) {
                page.lastWrapper().appendRaw(line)
            } else {
                page.push(new ParagraphWrapper(idx, line));
            }
        }
    })
    // console.log(page.elems.map(e => `${e.name}: ${e.closed}`))
    return page.parseAll();

}

class Editor {
    constructor(id, previewerId, uploadURL, displayLineNum) {
        this.MDLineClassName = "md-line";
        this.MDLineIndexClassName = "md-index";
        this.MDLineTextClassName = "md-text";
        this.uploadURL = uploadURL;

        this.root = document.querySelector(`#${id}`);
        this.init(!!displayLineNum);

        if (previewerId) {
            this.previewerEl = document.querySelector(`#${previewerId}`);
        }

        this.bindEvents();
    }

    init(displayLineNum) {
        this.root.classList.add('md-editor');

        this.numRoot = document.createElement('aside');
        if (!displayLineNum) this.numRoot.style.display = "none";
        this.root.appendChild(this.numRoot);

        this.editorRoot = document.createElement('div');
        this.root.appendChild(this.editorRoot);
        this.editorRoot.contentEditable = true;
        this.editorRoot.innerHTML = "<div><br></div>"

    }

    insertText(text) {
        this.editorRoot.focus();
        document.execCommand("insertText", false, text);
        this.render();
    }

    bindEvents() {
        const __selectCurrentLine = (e) => {
            // Deprecated
            let target = window.getSelection().getRangeAt(0).commonAncestorContainer.parentNode;
            Array.from(this.editorRoot.querySelectorAll(".md-line")).forEach((ln) => {
                ln.classList.remove('md-focus');
            });
            target.classList.add('md-focus');
        };
        const __render = (e) => {
            // Deprecated
            let lines = this.walkThrough();
            if (this.previewerEl) {
                let renderedHTML = dispatch(lines);
                this.previewerEl.innerHTML = renderedHTML;
            }
            selectCurrentLine();
        };
        this.editorRoot.addEventListener('keyup', () => this.render());
        this.editorRoot.addEventListener('click', () => this.selectCurrentLine());
        this.editorRoot.addEventListener('paste', (e) => {
            const evt = e || window.event;
            evt.stopPropagation();
            evt.preventDefault();
            let pasting = evt.clipboardData.getData('text');
            document.execCommand('insertText', false, pasting);
        });
        this.editorRoot.addEventListener('dragover', (e) => {
            const evt = e || window.event;
            evt.stopPropagation();
            evt.preventDefault();
        });
        this.editorRoot.addEventListener('drop', (e) => {
            const evt = e || window.event;
            evt.stopPropagation();
            evt.preventDefault();
            if (!this.uploadURL) return;

            let files = Array.from(evt.dataTransfer.files).filter(f => f.type.match(/image.*/));

            let formData = new FormData();
            files.forEach((file, idx) => {
                formData.append(idx + '', file);
            });
            this.render();
            fetch(this.uploadURL, {
                method: 'POST',
                body: formData
            }).then(res => {
                if (res.ok) {
                    res.json().then(j => {
                        let urls = j['urls'];
                        for (let i = 0; i < urls.length; i++) {
                            let url = urls[i];
                            if (url === false) continue;
                            document.execCommand(
                                'insertText',
                                false,
                                `\n![${files[i].name}](${url})`
                            );
                        }
                        this.render();
                    })
                }
            });
            this.selectCurrentLine();

        })
    }

    render() {
        let lines = this.walkThrough();
        if (this.previewerEl) {
            this.previewerEl.innerHTML = dispatch(lines);
        }
        this.selectCurrentLine();
    }

    selectCurrentLine() {
        let target = window.getSelection().getRangeAt(0).commonAncestorContainer.parentNode;
        Array.from(this.editorRoot.querySelectorAll(".md-line")).forEach((ln) => {
            ln.classList.remove('md-focus');
        });
        target.classList.add('md-focus');
    }

    walkThrough() {
        let divs = Array.from(this.editorRoot.children);
        let textLines = [];
        divs.forEach((div, idx) => {
            div.id = "e-" + idx;
            if (!div.classList.contains("md-line")) {
                div.classList.add("md-line");
            }

            if (BLOCK_REG.uploading.start.test(div.innerText)) {
                div.classList.add("md-editor-uploading");
            } else {
                div.classList.remove("md-editor-uploading");
            }
            textLines.push(div.innerText.replace('\n', ''));
        });
        // console.log(textLines.join('\n'))
        this.updateNum(divs.length);
        return textLines;
    }

    updateNum(max) {
        const nums = this.numRoot.querySelectorAll(".md-editor-num").length;
        for (let i = nums; i < max; i++) {
            let newNum = document.createElement('div');
            newNum.classList.add('md-editor-num');
            newNum.innerText = (i + 1)
            newNum.id = `n-${i}`
            this.numRoot.appendChild(newNum);
        }
        let children = this.numRoot.children;
        for (let i = nums; i > max; i--) {
            this.numRoot.removeChild(children[max]);
        }
    }
}

/*
const lines = `
![alt](http://sadfasd/sdf)

| dependency | version |
| :---: | :---: |
| jquery | 3.2.1 |
| marked | 0.3.4 |
| highlight.js | 9.12.0 |
# MDEditor
Markdown Editor, developed with pure HTML5. Support real time preview and code hightlighting. This repo is inspired by 
[marked](https://github.com/markedjs/marked), and is actually use it to render the markdown codes to html.

---

The reason for developing this repo is that I find it painful when rendering the md code to html elements with \`marked\` while **keeping their coresponding 
relationship**, i.e. which markdown code block is rendered into which html element. This repo is built upon \`marked\` and provides a ready-to-use
editor which is able to show real time preview. [hightlight.js](https://github.com/isagalaev/highlight.js) is also put into use for code rendering.

## Warning
MDEditor now only supports limited syntax:

-  \`Heading\` should only starts with several hash symbols \`#\`
-  \`table\` should be wrapped with \`|\` in every line
-  \`code block\` should be wrapped with 
-  \`horizontal splitter\` should use 3 or more \`-\`
-  \`list\` **there should be 2 \`space\`s between \`.\` and content, eg. \`1.[space][space]something\`

> It is a bug that list syntax requires 2 spaces, I will fix it as soon as I find out what the hell is going wrong.

## Advantage
1.  MDEditor can easily align the markdown code block and its corresponding html representation, 
by double click the line of code or representing html element (default)
2.  Use capital space 
(just press \`space\` key after pressing \`Caps\` key)
to simulate pressing \`Tab\` key. helpful when writing codes.
`.split('\n');
let rs = dispatch(lines)
console.log(rs);
*/
