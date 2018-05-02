
const TEXT_NODE = 3;
const ELEM_NODE = 1;
const BLOCK_REG = {
    code: {
        start: /^```[\s.]*/,
        end: /^```\s*/
    },
    list: {
        start: /^(\d+\.|\*|-) .*/,
        end: /^$/
    },
    table: {
        start: /\|/,
        end: /^$/
    },
    blockquote: {
        start: /^> .*/,
        end: /^$/
    }
};
let AUTO_SYNC = true;

function hash(id) {
    let previewId = id;
    while(!document.getElementById("line-"+previewId+"-preview")){
        previewId --;
        if(previewId < 0){
            break;
        }
    }
    return ["line-"+id, previewId < 0? "" : "line-"+previewId+"-preview"]
}

function getBlockName(str) {
    if(BLOCK_REG.code.start.test(str)){
        return 'code';
    }else if(BLOCK_REG.list.start.test(str)){
        return 'list';
    }else if(BLOCK_REG.table.start.test(str)){
        return 'table';
    }else if(BLOCK_REG.blockquote.start.test(str)){
        return 'blockquote';
    }else{
        return null;
    }
}

function singleLine(str) {
    if(/^#+ .*/.test(str)){
        return true;
    }else if(/^-{3,}/.test(str)){
        return true
    }

    return false;
}

class Editor{
    constructor(id) {
        this.config({});
        this.initElem(id);
    }

    config(configObj){
        this.lineClassName = configObj.lineClassName || 'editor-line'
    }

    initElem(id) {
        this.elem = $("#" + id);
        this.elem.attr('contentEditable', 'true');
        this.elem.on('keyup', ()=>{
            this.format();
        });

        this.elem.on('keyup', (e)=>{
            // if 'caps' + 'space'
            if(e.keyCode === 32 && e.originalEvent.getModifierState('CapsLock')){
                e.preventDefault();
                document.execCommand('insertText', false, '    ')
            }
        });

        this.elem.on('paste', (e)=>{
            // cancel original paste
            e.preventDefault();
            let pasting = e.originalEvent.clipboardData.getData('text');
            pasting.split("\n").map((line)=>{
                if(line === ""){
                    return "<br />"
                }else{
                    return line.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                }
            }).forEach((text)=>{
                document.execCommand("insertHTML", false, text);
                document.execCommand("insertText", false, "\n");
            });
        });

        this.elem.on('scroll', (e)=>{
            if(this.elem.height() + this.elem.scrollTop() >= this.elem[0].scrollHeight){
                // at the bottom
                this.previewer.scrollToBottom()
            }
        })
    }

    setPreviewer(previewer) {
        if(this.previewer!==previewer){
            this.previewer = previewer;
            this.previewer.setEditor(this)
        }else{
            return
        }

        this.elem.on('keyup', ()=>{
            this.previewer.preview(this.getSources());
        })
    }

    format() {
        let lineClassName = this.lineClassName;
        this.elem.contents().filter(function () {
            return this.nodeType === TEXT_NODE
        }).map(function () {
            let t = this.textContent || this.innerText || '';
            this.textContent = this.innerText = t.trim();
            return this;
        }).wrap(
            `<div class="${lineClassName}"></div>`
        ).end();

        let id = 0;
        this.elem.children().each(function () {
            let child = $(this);
            id++;
            child.prop('id', "line-"+id);
            let previewId = hash(id)[1];
            child.attr('ondblclick', `window.location.hash='${previewId}';`);
            child.attr('onmousemove', AUTO_SYNC?`window.location.hash='${previewId}';`:"");
                // .attr('onkeydown', AUTO_SYNC?`window.location.hash='${previewId}';`:"");

            if(!child.hasClass(lineClassName)){
                child.addClass(lineClassName);
            }
        });
    }

    getSources(){
        let srcs = [];
        let block = [];
        let blockEnd = null;
        let blockName = null;
        this.elem.children().each(function () {
            let srcElem = $(this);
            let text = srcElem.text() || "";
            text = text.trim();
            let src = {
                idInEditor: srcElem.attr("id"),
                text: srcElem.text()+"\n"
            };

            let curBlockName = blockName;

            if(BLOCK_REG[blockName] && BLOCK_REG[blockName].end.test(text)){
                // 块结尾
                curBlockName = null;
                block.push(src);
                srcs.push(block);
                block = [];
            }else if(blockName === 'code'){
                block.push(src);
            }else if(text === ""){
                // 非代码块空行
                if(block.length>0)  srcs.push(block);
                srcs.push([src]);
                block = [];
                curBlockName = null;
            }else if(singleLine(text)){
                // 单行
                if(block.length>0)  srcs.push(block);
                blockEnd = null;
                srcs.push([src]);
                block = [];
                curBlockName = null;
            }else if(getBlockName(text) !== null){
                if(block.length>0)  srcs.push(block);
                block = [src];
                curBlockName = getBlockName(text);
            }else{
                block.push(src);
            }

            blockName = curBlockName;
        });
        if(block.length > 0)
            srcs.push(block);
        return srcs;
    }
}

class Previewer{
    constructor(id, hl){
        this.initElem(id);
        this.hl = hl || hljs;
        marked.setOptions({
            highlight: (code)=>{
                return this.hl.highlightAuto(code).value;
            }

        });
        this.srcs = []
    }

    initElem(id){
        this.elem = $("#"+id);
    }

    setEditor(editor){
        if(this.editor !== editor){
            this.editor = editor;
            this.editor.setPreviewer(this);
        }else{
            return;
        }
    }

    preview(srcs){
        // srcs.forEach(src=>console.log(src));
        let htmlBuffer = "";
        srcs.forEach((block)=>{
        // console.log("====block=====");
            let text = "";
            block.forEach(src=>{
                text+=src.text;
            });
            // console.log(block);
            let html = $(marked(text) || "<p><br /></p>")
                .attr('id', block[0].idInEditor+"-preview")
                .attr('ondblclick', `window.location.hash='${block[0].idInEditor}'`)
                .attr('onmousemove', AUTO_SYNC?`window.location.hash='${block[0].idInEditor}'`:"")
                .prop("outerHTML")|| "";

            htmlBuffer+= html;
            // console.log(html);
        });
        this.elem.html(htmlBuffer);
    }

    scrollToBottom(){
        this.elem[0].scrollTop = this.elem[0].scrollHeight - this.elem.height()
    }
}
