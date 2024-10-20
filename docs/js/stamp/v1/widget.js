
class ShapocoNetStamp {
  static API_VERSION = 1;
  static LOCALHOST_PATTERN = /^(http:\/\/localhost:\d+)\//;
  static DEBUG_MODE = ShapocoNetStamp.LOCALHOST_PATTERN.test(window.location.href);
  static API_URL_BASE = ShapocoNetStamp.DEBUG_MODE ?
    `${window.location.href.match(ShapocoNetStamp.LOCALHOST_PATTERN)[1]}/stamp/v${ShapocoNetStamp.API_VERSION}` :
    `https://shapoco.net/stamp/v${ShapocoNetStamp.API_VERSION}`;
  static URL_POSTFIX = '20241020160600';
  static COOKIE_KEY = 'ShapocoNetStamp_clientId';

  constructor() {
    if (ShapocoNetStamp.DEBUG_MODE) {
      console.log('--------- DEBUG MODE --------');
      console.log(`API_URL_BASE = ${ShapocoNetStamp.API_URL_BASE}`);
    }

    this.cssLoaded = false;
    this.jsonLoaded = false;
    
    this.stamps = [];
    this.comments = [];
    this.history = [];
    this.commentRule = {
      maxLength: 64,
      ngWords: ['http://', 'https://', 'ftp://']
    };
    this.emojiCategories = [];
    this.emojiDict = {};

    this.container = document.querySelector('#shpcstamp_wrap');
    if (!this.container) {
      console.warn('#shapoconet_stamp_wrap is deprecated.');
      this.container = document.querySelector('#shapoconet_stamp_wrap');
    }
    this.stampButtonList = null;
    this.addButton = null;
    this.expandButton = null;
    this.statusMsg = null;
    this.location = window.location.href;
    this.pickerWindow = null;
    this.commentWindow = null;
    this.categoryList = null;
    this.emojiList = null;
    this.emojiBox = null;
    this.commnetBox = null;
    this.sendButton = null;
    this.clientId = null;

    document.cookie.split(';').forEach(entry => {
      const kv = entry.trim().split('=');
      if (kv[0].trim() == ShapocoNetStamp.COOKIE_KEY) {
        this.clientId = decodeURIComponent(kv[1].trim());
        if (ShapocoNetStamp.DEBUG_MODE) {
          console.log(`clientId=${this.clientId}`);
        }
      }
    });
  }

  init() {
    this.container.classList.add('shpcstamp');
    
    this.stampButtonList = document.createElement('span');
    this.stampButtonList.id = 'shpcstamp_stamp_list';
    this.stampButtonList.innerHTML = 'スタンプを読み込んでいます...&nbsp;';
    this.container.appendChild(this.stampButtonList);

    this.expandButton = document.createElement('button');
    this.expandButton.type = 'button';
    this.expandButton.id = 'shpcstamp_expand_button';
    this.expandButton.title = '全てのスタンプを表示';
    this.expandButton.innerHTML = '･･･';
    this.expandButton.style.display = 'none';
    this.container.appendChild(this.expandButton);
    this.expandButton.addEventListener('click', evt => this.onExpand(evt));

    this.addButton = document.createElement('button');
    this.addButton.type = 'button';
    this.addButton.id = 'shpcstamp_add_button';
    this.addButton.title = 'スタンプを追加する';
    this.addButton.innerHTML = '<span class="shpcstamp_emoji">➕</span>';
    this.container.appendChild(this.addButton);
    this.addButton.addEventListener('click', evt => {
      if (this.pickerWindow && this.pickerWindow.style.visibility != 'hidden') {
        this.hidePicker();
      }
      else {
        this.showPicker();
      }
    });

    this.statusMsg = document.createElement('span');
    this.statusMsg.id = 'shpcstamp_status';
    this.statusMsg.style.visibility = 'hidden';
    this.container.appendChild(this.statusMsg);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${ShapocoNetStamp.API_URL_BASE}/widget.css?${ShapocoNetStamp.URL_POSTFIX}`;
    document.body.append(link);
    link.addEventListener('load', evt => {
      this.cssLoaded = true;
      if (ShapocoNetStamp.DEBUG_MODE) console.log("CSS loaded.");
      this.onResourceLoaded(this);
    });

    var params = [];
    if (this.clientId) {
      params.push(`i=${encodeURIComponent(this.clientId)}`);
    }
    params.push(`s=${encodeURIComponent(this.location)}`);
    fetch(`${ShapocoNetStamp.API_URL_BASE}/api.php?${params.join('&')}`)
    
    var params = { s: this.location};
    if (this.clientId) params['i'] = this.clientId;
    this.fetchApi(params)
      .then(resp => { 
        if (ShapocoNetStamp.DEBUG_MODE) console.log(resp);
        this.procApiResponse(resp);
        this.jsonLoaded = true;
        if (ShapocoNetStamp.DEBUG_MODE) console.log("JSON loaded.");
        this.onResourceLoaded(this);
      })
      .catch(error => {
        console.log('ERROR: ' + error);
        this.stampButtonList.innerHTML = '';
        this.showMessage(false, 'スタンプを読み込めませんでした');
      });
  }

  onResourceLoaded() {
    if (this.cssLoaded && this.jsonLoaded) {
      this.stampButtonList.innerHTML = '';
      this.updateButtonList(true);
    }
  }

  procApiResponse(resp) {
    this.showMessage(resp.success, resp.message);
    if (resp.success) {
      this.stamps = resp.stamps;
      this.comments = resp.comments;
      this.history = resp.history;
      this.comments.reverse(); // 新着順にする
    }
    if (resp.clientId) {
      this.clientId = resp.clientId;
      document.cookie = `${ShapocoNetStamp.COOKIE_KEY}=${encodeURIComponent(this.clientId)}; Path=/; max-age=${86400 * 365}; SameSite=Lax; Secure`;
    }
    if (resp.commentRule) {
      this.commentRule = resp.commentRule;
    }
  }

  updateButtonList(first) {
    var tmpStamps = { ...this.stamps };
  
    // 既にあるボタンを更新する
    const buttons = this.stampButtonList.querySelectorAll('.shpcstamp_stamp');
    buttons.forEach(button => {
      const emoji = button.querySelector('.shpcstamp_emoji').innerHTML.trim();
      var numStamp = 0;
      var sent = false;
      if (emoji in tmpStamps) {
        numStamp = tmpStamps[emoji].count;
        sent = tmpStamps[emoji].sent;
        delete tmpStamps[emoji];
      }
      const numComment = this.comments.filter(comment => comment.emoji == emoji).length;
      this.updateButton(button, numStamp, numComment, sent);
    });
  
    // 足りないボタンを追加する
    var keys = Object.keys(tmpStamps);
    if (first) {
      keys.sort((a, b) => {
        if (tmpStamps[a].count < tmpStamps[b].count) return 1;
        if (tmpStamps[a].count > tmpStamps[b].count) return -1;
        return 0;
      });
    }
    keys.forEach(emoji => {
      const stamp = tmpStamps[emoji];
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('shpcstamp_stamp');
      button.addEventListener('click', evt => this.onStampClicked(button));
      button.addEventListener('mouseover', evt => this.onStampMouseOver(button));
      button.addEventListener('mouseleave', evt => this.onStampMouseLeave(button));
      button.addEventListener('wheel', evt => this.onStampWheel(button, evt));
      button.innerHTML =
        `<span class="shpcstamp_emoji">${emoji}</span>` +
        `<span class="shpcstamp_num_comment" style="background: url(${ShapocoNetStamp.API_URL_BASE}/images/with_comment.svg);"></span>` +
        `<span class="shpcstamp_num_stamp"></span>`;
      const numComment = this.comments.filter(comment => comment.emoji == emoji).length;
      this.updateButton(button, stamp.count, numComment, stamp.sent);      
      this.stampButtonList.appendChild(button);
    });

    if (first) {
      var numShown = 0;
      // 自分が送ったスタンプは常に表示
      this.stampButtonList.childNodes.forEach(button => {
        if (button.classList.contains('shpcstamp_sent')) {
          numShown += 1;
          button.style.display = 'inline-block';
        }
      });
      // 自分が送ったスタンプとそれ以外を合わせて最大10種類まで表示
      this.stampButtonList.childNodes.forEach(button => {
        if (!button.classList.contains('shpcstamp_sent')) {
          button.style.display = numShown < 10 ? 'inline-block' : 'none';
          numShown += 1;
        }
      });
      if (numShown > 10) {
        // スタンプが10種類を超えた場合は「・・・」ボタンを表示する
        this.expandButton.style.display = 'inline-block';
      }
    }
  }
  
  updateButton(button, numStamp, numComment, sent) {
    const spanNumStamp = button.querySelector('.shpcstamp_num_stamp');
    spanNumStamp.innerHTML = numStamp;
    
    const spanNumComment = button.querySelector('.shpcstamp_num_comment');
    spanNumComment.style.display = numComment > 0 ? 'inline-block' : 'none';
    
    if (sent) {
      button.classList.add('shpcstamp_sent');
      button.title = 'スタンプを取り消す';
    }
    else {
      button.classList.remove('shpcstamp_sent');
      button.title = 'スタンプを送る';
    }
  }
  
  onStampClicked(button) {
    const emoji = button.querySelector('.shpcstamp_emoji').innerHTML.trim();
    const remove = emoji in this.stamps ? this.stamps[emoji].sent : false;
    this.updateStamp(emoji, remove, '');
    if (this.commentWindow) {
      this.commentWindow.style.visibility = 'hidden';
    }
  }

  onStampMouseOver(button) {
    const emoji = button.querySelector('.shpcstamp_emoji').innerHTML.trim();
    const popup = this.getCommentWindow();
    const pickerShown = this.pickerWindow && this.pickerWindow.style.visibility == 'visible';
    var numComments = 0;

    const comments = this.comments.filter(entry => entry.emoji == emoji);

    if (comments.length > 0 && !pickerShown) {
      if (popup.style.visibility != 'visible') {
        const list = popup.querySelector('.shpcstamp_comment_list');
        var html = '';
        html += '<ul>';
        html += comments.map(entry => `<li>${this.escapeForHtml(entry.comment)}</li>`).join('');
        html += '</ul>';
        list.innerHTML = html;
        popup.style.visibility = 'visible';
        window.requestAnimationFrame(t => { 
          this.fixPopupPos(button, popup);
        });
        const title = popup.querySelector('.shpcstamp_comment_title');
        list.style.display = 'block';
        title.innerHTML =  `<span class="shpcstamp_emoji">💬</span> ${comments.length} 件のコメント`;
      }
    }
    else {
      popup.style.visibility = 'hidden';
    }
  }

  onStampMouseLeave(button) {
    const window = this.getCommentWindow();
    window.style.visibility = 'hidden';
  }
  
  onStampWheel(button, evt) {
    if (!(this.commentWindow && this.commentWindow.style.visibility == 'visible')) return;
    const wrapper = this.commentWindow.querySelector('.shpcstamp_comment_list');
    const ul = wrapper.querySelector('ul');
    if (ul.getBoundingClientRect().height <= wrapper.getBoundingClientRect().height) return;
    var amount = evt.deltaY;
    switch(evt.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE: amount = evt.deltaY * 25; break;
    case WheelEvent.DOM_DELTA_PAGE: amount = evt.deltaY * 250; break;
    }
    wrapper.scrollBy({top: amount, behavior: 'smooth'});
    evt.stopPropagation();
    evt.preventDefault();
  }

  onExpand(evt) {
    this.stampButtonList.childNodes.forEach(button => {
      button.style.display = 'inline-block';
    });
    this.expandButton.style.display = 'none';
  }

  updateStamp(emoji, remove, comment) {
    comment = comment.trim();
    var params = {
      s: this.location,
      m: remove ? 'd' : 'a',
      k: emoji,
    };
    if (this.clientId) params['i'] = this.clientId;
    if (comment) params['c'] = comment;
    this.fetchApi(params)
      .then(resp => { 
        if (ShapocoNetStamp.DEBUG_MODE) console.log(resp);
        this.procApiResponse(resp);
        if (resp.success) {
          if (this.emojiBox) this.emojiBox.value = '';
          if (this.commnetBox) this.commnetBox.value = '';
          this.updateButtonList(false);
        }
      })
      .catch(error => {
        console.log('ERROR: ' + error);
        this.showMessage(false, '通信エラー');
      });
  }
  
  fetchApi(params) {
    this.setButtonEnables(false);
    const encodedParams = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const url = `${ShapocoNetStamp.API_URL_BASE}/api.php?${encodedParams}`;
    if (ShapocoNetStamp.DEBUG_MODE) console.log(url);
    return fetch(url).then(resp => {
      this.setButtonEnables(true);
      return resp.json();
    });
  }

  setButtonEnables(enable) {
    const buttons = this.stampButtonList.querySelectorAll('.shpcstamp_stamp');
    const cursor = enable ? 'pointer' : 'wait';
    buttons.forEach(button => {
      button.disabled = !enable;
      button.style.cursor = cursor;
    });
    this.addButton.disabled = !enable;
    this.addButton.style.cursor = cursor;
  }

  showPicker() {
    this.getPickerWindow().style.visibility = 'visible';
    this.fixPopupPos(this.addButton, this.pickerWindow);
    this.validateEmojiAndComment();
  }

  hidePicker() {
    this.getPickerWindow().style.visibility = 'hidden';
  }

  onSendFromPicker() {
    this.updateStamp(this.emojiBox.value, false, this.commnetBox.value.trim());
    this.hidePicker();
  }

  getPickerWindow() {
    if (!this.pickerWindow) {
      const popup = this.createPopup('form', 'shpcstamp_picker');
      this.pickerWindow = popup;
      var html = '';
      html += `<div>\n`;
      html += `<select id="shpcstamp_picker_category" class="shpcstamp_emoji"></select>`;
      html += `</div>\n`;
      html += `<div id="shpcstamp_popup_list">\n`;
      html += `絵文字を読み込んでいます...\n`;
      html += `</div>\n`;
      html += `<div>\n`;
      html += `<input type="text" id="shpcstamp_popup_emoji" class="shpcstamp_emoji" style="width: 100%;" placeholder="↑から選択または直接入力">`;
      html += `</div>\n`;
      html += `<div>\n`;
      html += `<input type="text" id="shpcstamp_popup_commnet" style="width: 100%;" placeholder="コメント (任意, 公開されます)">\n`;
      html += `</div>\n`;
      html += `<div style="text-align: right;">\n`;
      html += `<button type="button" id="shpcstamp_picker_cancel">キャンセル</button>\n`;
      html += `<button type="button" id="shpcstamp_picker_send" disabled="disabled">スタンプ送信</button>\n`;
      html += `</div>\n`;
      popup.innerHTML = html;
      this.categoryList = popup.querySelector('#shpcstamp_picker_category');
      this.emojiList = popup.querySelector('#shpcstamp_popup_list');
      this.emojiBox = popup.querySelector('#shpcstamp_popup_emoji');
      this.commnetBox = popup.querySelector('#shpcstamp_popup_commnet');
      this.sendButton = popup.querySelector('#shpcstamp_picker_send');
      this.categoryList.addEventListener('change', evt => this.onStampCategoryChanged());
      this.emojiBox.addEventListener('change', evt => this.validateEmojiAndComment());
      this.emojiBox.addEventListener('keyup', evt => this.onPickerKeyUp(evt));
      this.commnetBox.addEventListener('change', evt => this.validateEmojiAndComment());
      this.commnetBox.addEventListener('keyup', evt => this.onPickerKeyUp(evt));
      this.sendButton.addEventListener('click', evt => this.onSendFromPicker());
      popup.onsubmit = 'return false;';
      popup.querySelector('#shpcstamp_picker_cancel').addEventListener('click', evt => this.hidePicker());
    }

    // document.body に appendChild してもすぐには表示サイズを取得できないので
    // アニメーションを要求する
    window.requestAnimationFrame(t => { 
      this.fixPopupPos(this.addButton, this.pickerWindow);
    });

    // emoji 辞書のロード
    fetch(`${ShapocoNetStamp.API_URL_BASE}/emoji16.0.json?${ShapocoNetStamp.URL_POSTFIX}`)
      .then(response => response.json())
      .then(data => { 
        this.emojiCategories = data;
        var html = '';
        var icat = 0;
        html += `<option value="-1">⭐ 最近使われたスタンプ</option>`;
        data.forEach(cat => {
          html += `<option value="${icat}">${cat.items[0].emoji} ${cat.name}</option>`;
          cat.items.forEach(item => {
            this.emojiDict[item.emoji] = item;
          });
          icat += 1;
        });
        this.pickerWindow.querySelector('#shpcstamp_picker_category').innerHTML = html;
        this.onStampCategoryChanged();
        this.fixPopupPos(this.addButton, this.pickerWindow);
      })
      .catch(error => {
        console.log('ERROR: ' + error);
        this.emojiList.innerHTML = '通信エラー';
      });

    return this.pickerWindow;
  }

  getCommentWindow() {
    if (!this.commentWindow) {
      const window = this.createPopup('form', 'shpcstamp_comment');
      this.commentWindow = window;
      var html = '';
      html += `<div class="shpcstamp_comment_title"></div>\n`;
      html += `<div class="shpcstamp_comment_list">\n`;
      html += `コメント\n`;
      html += `</div>\n`;
      window.innerHTML = html;
    }
    return this.commentWindow;
  }

  createPopup(tag, id) {
    const popup = document.createElement(tag);
    popup.classList.add('shpcstamp');
    popup.classList.add('shpcstamp_popup');
    popup.id = id;
    popup.style.visibility = 'hidden';
    popup.style.zIndex = '999';
    document.body.appendChild(popup);
    return popup;
  }

  onPickerKeyUp(evt) {
    const valid = this.validateEmojiAndComment();
    if (evt.keyCode == 13) { // Enter
      if (valid) this.onSendFromPicker();
    }
  }

  validateEmojiAndComment() {
    var emojiValid = this.emojiBox.value in this.emojiDict;
    var commentValid = true;
    const comment = this.commnetBox.value;
    if (comment.length > this.commentRule.maxLength) {
      commentValid = false;
    }
    else if (/<\/?\w+>/.test(comment)) {
      commentValid = false;
    }
    else if (comment) {
      this.commentRule.ngWords.forEach(ngWord => {
        if (comment.includes(ngWord)) {
          commentValid = false;
          return;
        }
      });
    }
    this.emojiBox.style.background = (!this.emojiBox.value || emojiValid) ? null : '#fcc';
    this.commnetBox.style.background = commentValid ? null : '#fcc';
    const valid = emojiValid && commentValid;
    this.sendButton.disabled = !valid;
    return valid;
  }

  fixPopupPos(button, popup) {
    const buttonRect = button.getBoundingClientRect();
    const upperSpace = buttonRect.top;
    const lowerSpace = window.innerHeight - buttonRect.top + buttonRect.height;

    const pickerRect = popup.getBoundingClientRect();
    var left = buttonRect.left + (buttonRect.width - pickerRect.width) / 2;
    if (left < 5) {
      left = 5;
    }
    else if (left + pickerRect.width > window.scrollX + window.innerWidth - 5) {
      left = window.scrollX + window.innerWidth - 5 - pickerRect.width;
    }

    var top = upperSpace > lowerSpace ?
      buttonRect.top + window.scrollY - pickerRect.height - 5 :
      buttonRect.bottom + window.scrollY + 5;

    popup.style.position = 'position';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  onStampCategoryChanged() {
    const icat = parseInt(this.categoryList.value);
    this.emojiList.innerHTML = '';
    var items = [];
    if (icat < 0) {
      items = this.history.map(emoji => this.emojiDict[emoji]);
    }
    else {
      items = this.emojiCategories[icat].items;
    }
    items.forEach(item => {
      const link = document.createElement('a');
      link.href = 'javascript:void(0)';
      link.classList.add('shpcstamp_emoji');
      link.title = item.name;
      link.innerHTML = item.emoji;
      link.addEventListener('click', evt=>this.onStampSelected(link));
      this.emojiList.appendChild(link);
    });

  }

  onStampSelected(link) {
    this.emojiBox.value = link.textContent;
    this.validateEmojiAndComment();
  }

  showMessage(success, message) {
    if (success) {
      this.statusMsg.style.visibility = 'hidden';
      this.statusMsg.innerHTML = '';
    }
    else {
      this.statusMsg.innerHTML = '⚠ ' + (message ? message : '不明なエラー');
      this.statusMsg.style.visibility = 'visible';
    }
  }
  
  escapeForHtml(s) {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .replaceAll(" ", '&nbsp;')
      .replaceAll("　", '&#x3000;');
  }

}

const shapocoNetStamp = new ShapocoNetStamp();
shapocoNetStamp.init();
