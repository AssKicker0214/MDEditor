
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

function endWith(str) {
    if(/^```[\s.]*/.test(str)){
        return /^```\s*/
    }else if(/^(\d+\.|\*|-) .*/.test(str)){
        return /^$/
    }else if(/^> .*/.test(str)){
        return /^$/
    }else if(/^# .*/.test(str)){
        return /^$/
    }else if(/\|/.test(str)){
        return /^$/
    }else{
        return null
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
        this.initElem(id)

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

        // document.addEventListener( 'keydown', function( event ) {
        //     let caps = event.getModifierState( 'CapsLock' );
        //     console.log( caps ); // true when you press the keyboard CapsLock key
        // });

        this.elem.on('paste', (e)=>{
            // cancel original paste
            e.preventDefault();
            let pasting = e.originalEvent.clipboardData.getData('text');
            let plains = pasting.split("\n").map((line)=>{
                if(line === ""){
                    return "<br />"
                }else{
                    return line.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                }
            }).forEach((text)=>{
                document.execCommand("insertHTML", false, text);
                document.execCommand("insertText", false, "\n");
            });
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
            // console.log("keyup");
        })
    }

    format() {
        console.log("formating");
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
            child.prop('id', "line-"+id++);

            if(!child.hasClass(lineClassName)){
                child.addClass(lineClassName)
            }
        })
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
            let single = false;

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
            // console.log(text+" -> "+blockEnd);
            // if((blockEnd && blockEnd.test(text))){
            //     block.push(src);
            //     srcs.push(block);
            //     blockEnd = null;
            //     block = [];
            //     console.log("---end")
            // }else if(singleLine(text)){
            //     if(block.length>0)  srcs.push(block);
            //     blockEnd = null;
            //     srcs.push([src]);
            //     block = []
            //     console.log("single");
            // }else{
            //     block.push(src);
            //     blockEnd = endWith(text) || blockEnd;
            // }
        });
        if(block.length > 0)
            srcs.push(block);
        console.log(srcs.length);
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
            console.log(block);
            let html = $(marked(text)).attr('id', block[0].idInEditor+"-preview").prop("outerHTML") || "";

            htmlBuffer+= html;
            console.log(html);
        });
        this.elem.html(htmlBuffer);
    }
}
