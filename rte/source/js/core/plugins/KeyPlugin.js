/*************************************************************************
*
* ADOBE CONFIDENTIAL
* ___________________
*
*  Copyright 2012 Adobe Systems Incorporated
*  All Rights Reserved.
*
* NOTICE:  All information contained herein is, and remains
* the property of Adobe Systems Incorporated and its suppliers,
* if any.  The intellectual and technical concepts contained
* herein are proprietary to Adobe Systems Incorporated and its
* suppliers and are protected by trade secret or copyright law.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe Systems Incorporated.
**************************************************************************/

/**
 * @class CUI.rte.plugins.KeyPlugin
 * @extends CUI.rte.plugins.Plugin
 * <p>This class implements the basic key handling as a plugin.</p>
 * <p>The plugin ID is "<b>keys</b>".</p>
 * <p><b>Features</b></p>
 * <p>This plugin has no features, as it processes keystrokes globally.</p>
 * @since 5.3
 */

CUI.rte.plugins.KeyPlugin = new Class({

    toString: "KeyPlugin",

    extend: CUI.rte.plugins.Plugin,

    /**
     * @cfg {Number} tabSize
     * Number of &amp;nbsp;-s to be inserted if the tab key is hit (defaults to 4). Note
     * that the tab key works as a navigation aid when used inside a table, so this option
     * will only take effect outside a table.
     */

    /**
     * @private
     */
    mustEnsureBlocks: false,

    /**
     * @private
     */
    mustHandleAdditionalBR: false,

    /**
     * @private
     */
    _init: function(editorKernel) {
        this.inherited(arguments);
        editorKernel.addPluginListener("beforekeydown", this.handleKeyDown, this, this,
                false);
        editorKernel.addPluginListener("keyup", this.handleKeyUp, this, this,
                false);
    },

    /**
     * @private
     */
    isEOB: function(context, selection) {
        var nodeToCheck, offsetToCheck;
        if (CUI.rte.Selection.isSelection(selection)) {
            nodeToCheck = selection.endNode;
            offsetToCheck = selection.endOffset;
        } else {
            nodeToCheck = selection.startNode;
            offsetToCheck = selection.startOffset;
        }
        return CUI.rte.DomProcessor.isBlockEnd(context, nodeToCheck, offsetToCheck);
    },

    /**
     * @private
     */
    isTempBR: function(br) {
        var com = CUI.rte.Common;
        return !com.isNull(br) && (com.isAttribDefined(br, com.BR_TEMP_ATTRIB)
                || (com.isAttribDefined(br, "type")
                    && (com.getAttribute(br, "type", false) === "_moz")));
    },

    /**
     * Handles key strokes.
     * @param {Object} e The plugin event
     * @private
     */
    handleKeyDown: function(e) {

        if (e.cancelKey) {
            return;
        }

        var context = e.editContext;
        var dpr = CUI.rte.DomProcessor;
        var sel = CUI.rte.Selection;
        var com = CUI.rte.Common;
        var lut = CUI.rte.ListUtils;
        var ek = this.editorKernel;

        // IE allows invalid caret positions - we cancel key strokes other than caret keys
        // if this is the case
        var selection = (com.ua.isIE ? ek.createQualifiedSelection(context) : null);
        if (com.ua.isIE && !selection) {
            if (!e.isCaretKey()) {
                e.cancelKey = true;
            }
            return;
        }

        function ensureSelection() {
            if (selection == null) {
                selection = ek.createQualifiedSelection(context);
            }
            return selection;
        }

        var cancelKey = false;

        // handle TAB key
        if (e.isTab()) {
            var tabStr = "";
            var tabSize = this.config.tabSize;
            for (var nbsp = 0; nbsp < tabSize; nbsp++) {
                tabStr += "&nbsp;";
            }
            ek.execCmd("InsertHTML", tabStr);
            cancelKey = true;
        }

        // handle Space key - current Gecko releases insert an additional <br> if a space
        // is inserted at the end of an edit block
        this.mustHandleAdditionalBR = false;
        if (com.ua.isGecko && (e.isSpace() || e.isBackSpace())) {
            selection = ensureSelection();
            if (this.isEOB(context, selection)) {
                this.mustHandleAdditionalBR = true;
            }
        }

        // handle ENTER key
        this.mustEnsureBlocks = false;
        if (e.isEnter() && !cancelKey) {
            if (!e.isShift()) {
                var useBrowserCmd = false;
                var isBeforeNestedList = false;
                try {
                    selection = ensureSelection();
                    if (sel.isSelection(selection)) {
                        CUI.rte.commands.executeDelete(context);
                    }
                    selection = ek.createQualifiedSelection(context);
                    var node = selection.startNode;
                    var offset = selection.startOffset;
                    var editBlock = dpr.getEditBlock(context, node);
                    var nestedLists;
                    if (com.isTag(editBlock, "li")) {
                        useBrowserCmd = true;
                        // corner case: inserting at the last character of a parent item
                        // in a nested list must be handled differently for Gecko browsers
                        // (bug #37580)
                        nestedLists = lut.getNestedLists(editBlock);
                        if (com.ua.isGecko) {
                            isBeforeNestedList = lut.isPositionBeforeNestedList(context,
                                    node, offset);
                            useBrowserCmd = !isBeforeNestedList;
                        }
                    }
                    if (!useBrowserCmd) {
                        // if we're inserting before an empty line determinator
                        // (<p>line<br><br>|<br>), we need to keep that determinator on
                        // the old line and have to insert behind instead
                        offset = (dpr.isEmptyLineDeterminator(context, node) ? 0 : offset);
                        var para = dpr.insertParagraph(context, node, offset);
                        if (isBeforeNestedList) {
                            var placeholder = dpr.createGeckoPlaceholder(context);
                            com.insertBefore(para, placeholder, nestedLists[0]);
                        }
                        var nodeToSelect;
                        if (com.ua.isGecko) {
                            nodeToSelect = com.getFirstChild(para);
                            if (!nodeToSelect) {
                                nodeToSelect = para;
                            } else if (nodeToSelect.nodeType == 3) {
                                nodeToSelect = nodeToSelect.parentNode;
                            }
                        } else {
                            nodeToSelect = para;
                        }
                        sel.selectNode(context, nodeToSelect, true);
                        // both Gecko, Webkit and IE/W3C-compliant don't change the scroll
                        // offset accordingly, so we must do it on our own
                        if (!com.isOldIE && context.iFrame) {
                            // as we don't support complex layouts yet, this simple
                            // calculation is currently enough
                            var scrollTop = context.root.scrollTop;
                            var iframeHeight = context.iFrame.clientHeight;
                            var paraTop = para.offsetTop;
                            var paraHeight = para.clientHeight;
                            var scrollBottom = scrollTop + iframeHeight;
                            var paraBottom = paraTop + paraHeight;
                            if (paraBottom > scrollBottom) {
                                context.root.scrollTop = paraBottom - iframeHeight;
                            }
                        }
                        cancelKey = true;
                    }
                } catch (e) {
                    // window.console.log("Error: " + e);
                    // com.ieLog("Error: " + e.message, true);
                    // if we cannot insert a paragraph, use browser's ENTER handling instead
                    useBrowserCmd = true;
                }
                if (useBrowserCmd) {
                    if (com.ua.isGecko) {
                        // Workaround for Gecko bug that always inserts lines instead of
                        // paragraphs when for example a list is finished by pressing
                        // Enter on an empty list item
                        this.mustEnsureBlocks = true;
                    }
                }
            } else if (com.ua.isWebKit || com.ua.isGecko) {
                // handle Shift + Enter for WebKit & Gecko
                selection = ensureSelection();
                if (sel.isSelection(selection)) {
                    CUI.rte.commands.executeDelete(context);
                }
                selection = ek.createQualifiedSelection(context);
                var selNode = selection.startNode;
                var selOffs = selection.startOffset;
                var newBr = context.createElement("br");
                var caretPos = sel.getCaretPos(context);
                if (dpr.isBlockEnd(context, selNode, selOffs)
                        && !dpr.isEmptyLineDeterminator(context, selNode)) {
                    var isBlockStart = dpr.isBlockStart(context, selNode, selOffs);
                    if (!isBlockStart) {
                        var helperBr = context.createElement("br");
                        com.setAttribute(helperBr, com.BR_TEMP_ATTRIB, "brEOB");
                        dpr.insertElement(context, helperBr, selNode, selOffs);
                    }
                    dpr.insertElement(context, newBr, selNode, selOffs);
                } else {
                    dpr.insertElement(context, newBr, selNode, selOffs);
                }
                var afterBr = com.getNextCharacterNode(context, newBr);
                if (afterBr.nodeType == 1) {
                    sel.selectNode(context, afterBr, true);
                } else {
                    sel.setCaretPos(context, caretPos + 1);
                }
                // TODO handle scrolling, if required
                cancelKey = true;
            }
        }

        // pre-handle auxiliary roots
        this.auxRootParaNodeCnt = 0;
        if ((e.isBackSpace() || e.isDelete()) && !cancelKey) {
            selection = ensureSelection();
            if (com.ua.isOldIE) { // this is just necessary for IE < 9
                // handle deletion of empty lines before tables
                var emptyLineNode = dpr.getEmptyLine(context, selection);
                if ((emptyLineNode != null) && !com.isTag(emptyLineNode, com.TABLE_CELLS)) {
                    var pos = sel.getCaretPos(context);
                    emptyLineNode.parentNode.removeChild(emptyLineNode);
                    if (e.isBackSpace() && (pos > 0)) {
                        pos--;
                        sel.setCaretPos(context, pos);
                    }
                    cancelKey = true;
                }
            }
            var nodeList = dpr.createNodeList(context, selection);
            var auxRoot = com.getTagInPath(context, nodeList.commonAncestor,
                    dpr.AUXILIARY_ROOT_TAGS);
            if (auxRoot) {
                this.auxRootParaNodeCnt = com.getChildNodesByType(auxRoot, "p").length;
            }
        }

        e.cancelKey = cancelKey;
    },

    /**
     * Handles post-processing required for all browsers. The method is called whenever a
     * key has been pressed.
     * @param {Object} e The plugin event
     * @private
     */
    handleKeyUp: function(e) {

        var sel = CUI.rte.Selection;
        var com = CUI.rte.Common;
        var dpr = CUI.rte.DomProcessor;
        var context = e.editContext;
        var node, selection;

        // handle Gecko/Webkit <br>-placeholders
        if (com.ua.isGecko || com.ua.isWebKit) {
            this.handleBRPlaceholders(context);
        }

        // handle Webkit adding spans deliberately
        if (com.ua.isWebKit) {
            this.handleJunkSpans(context);
        }

        // handle IE autolinks if necessary; note that this is not necessary anymore with
        // IE >= 9, as this has an option to switch auto linking off (see initialization
        // code in EditorKernel#initializeEditContext)
        if (com.ua.isOldIE) {
            // older IE versions add auto links _after_ the keyup event is triggered
            // (especially when re-adding the link after deleting something in a
            // potential URL), so we use deferred execution here to be sure
            CUI.rte.Utils.defer(this.handleIEAutoLinks, 1, this, [ context ]);
        }

        // handle "absolutely empty" content
        dpr.ensureMinimumContent(context);
        if (this.mustEnsureBlocks) {
            // workaround for Gecko bug/inconsistency; see handleKeys
            selection = sel.getSelection(context);
            if (selection.focusNode && (selection.focusNode.nodeType == 1)) {
                node = selection.focusNode.childNodes[selection.focusOffset];
                if (com.isRootNode(context, node.parentNode) && com.isTag(node, "br")) {
                    var pNode = dpr.insertAsParent(context, node, "p", null);
                    sel.selectNode(context, pNode, true);
                }
            }
        }

        // handle Gecko's (mis-) behaviour of adding additional br's after inserting a
        // space at the end of an edit block
        var fn, nextNode;
        if (this.mustHandleAdditionalBR) {
            selection = sel.getSelection(context);
            fn = selection.focusNode;
            if (fn) {
                nextNode = fn.nextSibling;
                if (com.isTag(nextNode, "br")) {
                    com.setAttribute(nextNode, com.BR_TEMP_ATTRIB, "brEOB");
                }
            }
        } else if (e.isDelete()) {
            selection = sel.getSelection(context);
            fn = selection.focusNode;
            if (fn && (fn.nodeType == 3)) {
                var text = fn.nodeValue;
                var isSpaceDelimited = (text.length > 0
                        ? (text.charAt(text.length - 1) == " ") : false);
                if (isSpaceDelimited) {
                    nextNode = fn.nextSibling;
                    if (com.isTag(nextNode, "br")
                            && dpr.isBlockEnd(context, nextNode, null)) {
                        com.setAttribute(nextNode, com.BR_TEMP_ATTRIB, "brEOB");
                    }
                }
            }
        }

        if (e.isBackSpace() || e.isDelete()) {
            if (com.ua.isIE) {
                // Yet another IE bug: if the last character of a styled area is deleted,
                // IE stores the physical style internally and inserts all characters
                // typed with that physical style (but not the span we actually need).
                // So we're trying to flush this internal buffer by moving the caret forward
                // and backwards
                try {
                    var range = sel.getLeadRange(context);
                    var oldRange = range.duplicate();
                    if (range.move("character", 1) == 1) {
                        sel.selectRange(context, range);
                    } else if (range.move("character", -1) == -1) {
                        sel.selectRange(context, range);
                    }
                    sel.selectRange(context, oldRange);
                } catch (ex) {
                    // might fail, if for example an EOB anchor is tried being deleted using
                    // backspace (which won't work at all on IE); just ignore this
                }
            }
            // handle auxiliary block roots
            selection = this.editorKernel.createQualifiedSelection(context);
            if (selection && !sel.isSelection(selection)) {
                node = selection.startNode;
                var scopedBlock = dpr.getScopedBlockNode(context, node);
                if (scopedBlock) {
                    if (!scopedBlock.isAuxiliaryRoot) {
                        var blockParent = scopedBlock.dom.parentNode;
                        if (com.isTag(blockParent, dpr.AUXILIARY_ROOT_TAGS)) {
                            var parentParaNodes = com.getChildNodesByType(blockParent, "p");
                            var parentParaNodeCnt = parentParaNodes.length;
                            if ((parentParaNodeCnt == 1)
                                    && (parentParaNodeCnt < this.auxRootParaNodeCnt)) {
                                var blockNode = parentParaNodes[0];
                                // preserve indents & text alignments
                                if (!blockNode.style.textAlign
                                        && !blockNode.style.marginLeft) {
                                    var bookmark;
                                    if (com.ua.isIE) {
                                        bookmark = sel.createSelectionBookmark(context);
                                    }
                                    dpr.removeWithoutChildren(blockNode);
                                    if (com.ua.isIE) {
                                        sel.selectBookmark(context, bookmark);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    /**
     * <p>Handles post-processing required for preventing automatically generated links
     * by IE.</p>
     * @private
     */
    handleIEAutoLinks: function(context) {
        var com = CUI.rte.Common;
        var sel = CUI.rte.Selection;
        var hasRemoved = false;
        var caretPos;
        // remove all links that don't have a _rte_href attribute
        var aTags = context.root.getElementsByTagName("A");
        var aCnt = aTags.length;
        for (var a = aCnt - 1; a >= 0; a--) {
            var anchor = aTags[a];
            if (com.isAttribDefined(anchor, "href")
                    && !com.isAttribDefined(anchor, com.HREF_ATTRIB)) {
                CUI.rte.DomProcessor.removeWithoutChildren(anchor);
                if (!hasRemoved && com.ua.isOldIE) {
                    // IE < 9 may have an invalid selection after removing an auto-link
                    // (if caret is inside the auto-link that is being removed), so we
                    // save the caret and restore it at the end
                    caretPos = sel.getCaretPos(context);
                    hasRemoved = true;
                }
            }
        }
        if (hasRemoved && com.ua.isOldIE) {
            sel.setCaretPos(context, caretPos);
        }
    },

    /**
     * <p>Handles &lt;br&gt; placeholders for empty lines.</p>
     * <p>Those placeholders get inserted on Shift+Enter and will either removed in this
     * method if it is not necessary anymore because there was content inserted before or
     * the placeholder marker is removed if there is another br placeholder found
     * directly after the existing placeholder &lt;br&gt;.</p>
     * @private
     */
    handleBRPlaceholders: function(context) {
        var com = CUI.rte.Common;
        var dpr = CUI.rte.DomProcessor;
        var brTags = context.root.getElementsByTagName("BR");
        var brCnt = brTags.length;
        for (var i = 0; i < brCnt; i++) {
            var brToCheck = brTags[i];
            if (this.isTempBR(brToCheck)) {
                var prevCharNode = com.getPreviousCharacterNode(context, brToCheck,
                        com.EDITBLOCK_TAGS);
                var nextCharNode = com.getNextCharacterNode(context, brToCheck,
                            com.EDITBLOCK_TAGS);
                if ((!com.isTag(prevCharNode, "br") && !com.isNull(prevCharNode))
                        || !com.isNull(nextCharNode)) {
                    // additional cases: keep if previous character node ends with a space
                    // or is an anchor (anchor: on Gecko only)
                    var prevNodeLen = 0;
                    var isAnchor = false;
                    if (prevCharNode) {
                        var prevNodeText = com.getNodeText(prevCharNode);
                        prevNodeLen = prevNodeText.length;
                        isAnchor = com.ua.isGecko &&
                                (dpr.checkNamedAnchor(prevCharNode) != null);
                    }
                    var lastChar = (prevNodeLen > 0 ? prevNodeText.charAt(prevNodeLen - 1)
                            : "");
                    if ((lastChar !== " ") && !isAnchor) {
                        brToCheck.parentNode.removeChild(brToCheck);
                    }
                }
            }
        }
    },

    /**
     * <p>Handles spans that get inserted deliberately by Webkit.</p>
     * <p>This is for example the case if the user deletes the final character of a
     * sub-/superscripted fragment and then directly adds another character.</p>
     * @param {CUI.rte.EditContext} context The edit context
     */
    handleJunkSpans: function(context) {
        var com = CUI.rte.Common;
        var selection = this.editorKernel.createQualifiedSelection(context);
        if (selection && !selection.isSelection) {
            var toCheck = selection.startNode;
            toCheck = (toCheck.nodeType === 3 ? com.getParentNode(context, toCheck)
                    : toCheck);
            if (com.isTag(toCheck, "span")) {
                var styleAttrib = com.getAttribute(toCheck, "style", true);
                if (styleAttrib) {
                    if (styleAttrib.indexOf("font-size") >= 0) {
                        CUI.rte.DomProcessor.removeWithoutChildren(toCheck);
                    }
                }
            }
        }
    },

    notifyPluginConfig: function(pluginConfig) {
        pluginConfig = pluginConfig || { };
        CUI.rte.Utils.applyDefaults(pluginConfig, {
            "tabSize": 4
        });
        this.config = pluginConfig;
    }

});


// register plugin
CUI.rte.plugins.PluginRegistry.register("keys", CUI.rte.plugins.KeyPlugin);