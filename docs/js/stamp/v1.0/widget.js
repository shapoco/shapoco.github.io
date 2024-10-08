
class ShapocoNetStamp {
  static API_URL_BASE = 'https://shapoco.net/stamp/v1.0';
  static COOKIE_KEY = 'ShapocoNetStamp_clientId';

  constructor() {
    this.cssLoaded = false;
    this.jsonLoaded = false;
    this.stamps = [];
    this.history = [];
    this.emojiCategories = [];
    this.emojiDict = {};
    this.container = document.querySelector('#shapoconet_stamp_wrap');
    this.stampButtonList = null;
    this.addButton = null;
    this.statusMsg = null;
    this.location = window.location.href;
    this.isDebugMode = this.location.startsWith('http://localhost:');
    this.picker = null;
    this.categoryList = null;
    this.emojiList = null;
    this.inputBox = null;
    this.sendButton = null;
    this.clientId = null;

    const d = new Date();
    this.urlPostfix = `${d.getDate()}-${d.getMonth() + 1}-${d.getDate()}b`;

    document.cookie.split(';').forEach(entry => {
      const kv = entry.trim().split('=');
      if (kv[0].trim() == ShapocoNetStamp.COOKIE_KEY) {
        this.clientId = decodeURIComponent(kv[1].trim());
        if (this.isDebugMode) {
          console.log(`clientId=${this.clientId}`);
        }
      }
    });
  }

  init() {
    this.container.classList.add('shapoconet_stamp_ui');
    
    this.stampButtonList = document.createElement('span');
    this.stampButtonList.id = 'shapoconet_stamp_stamp_list';
    this.stampButtonList.innerHTML = 'スタンプを読み込んでいます...&nbsp;';
    this.container.appendChild(this.stampButtonList);

    this.addButton = document.createElement('button');
    this.addButton.type = 'button';
    this.addButton.id = 'shapoconet_stamp_add_button';
    this.addButton.innerHTML = '<span class="shapoconet_stamp_emoji" title="スタンプを追加する">➕</span>';
    this.container.appendChild(this.addButton);
    this.addButton.addEventListener('click', evt => {
      if (this.picker && this.picker.style.display != 'none') {
        this.hidePicker();
      }
      else {
        this.showPicker();
      }
    });

    this.statusMsg = document.createElement('span');
    this.statusMsg.id = 'shapoconet_stamp_status';
    this.statusMsg.style.display = 'none';
    this.container.appendChild(this.statusMsg);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${ShapocoNetStamp.API_URL_BASE}/widget.css?${this.urlPostfix}`;
    document.body.append(link);
    link.addEventListener('load', evt => {
      this.cssLoaded = true;
      if (this.isDebugMode) console.log("CSS loaded.");
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
      .then(resp => resp.json())
      .then(resp => { 
        if (this.isDebugMode) console.log(resp);
        this.stamps = resp.stamps;
        this.history = resp.history;
        this.procApiResponse(resp);
        this.jsonLoaded = true;
        if (this.isDebugMode) console.log("JSON loaded.");
        this.onResourceLoaded(this);
      })
      .catch(error => {
        this.stampButtonList.innerHTML = '';
        this.showMessage(false, 'スタンプを読み込めませんでした');
      });
  }

  onResourceLoaded() {
    if (this.cssLoaded && this.jsonLoaded) {
      this.stampButtonList.innerHTML = '';
      this.updateButtons(true);
    }
  }

  procApiResponse(resp) {
    this.showMessage(resp.success, resp.message);
    if (resp.success) {
      this.stamps = resp.stamps;
      this.history = resp.history;
    }
    if (resp.clientId) {
      this.clientId = resp.clientId;
      document.cookie = `${ShapocoNetStamp.COOKIE_KEY}=${encodeURIComponent(this.clientId)}; max-age=86400; SameSite=Lax; Secure`;
    }
  }

  updateButtons(sort) {
    var tmpStamps = { ...this.stamps };
  
    // 既にあるボタンを更新する
    const buttons = this.stampButtonList.querySelectorAll('.shapoconet_stamp_stamp');
    buttons.forEach(button => {
      const emoji = button.querySelector('.shapoconet_stamp_emoji').innerHTML.trim();
      var count = 0;
      var sent = false;
      if (emoji in tmpStamps) {
        count = tmpStamps[emoji].count;
        sent = tmpStamps[emoji].sent;
        delete tmpStamps[emoji];
      }
      this.updateButton(button, count, sent);
    });
  
    // 足りないボタンを追加する
    var keys = Object.keys(tmpStamps);
    if (sort) {
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
      button.classList.add('shapoconet_stamp_stamp');
      button.addEventListener('click', evt => this.stampClicked(button));
      button.innerHTML =
        `<span class="shapoconet_stamp_emoji">${emoji}</span>` +
        `<span class="shapoconet_stamp_count"></span>`;
      this.updateButton(button, stamp.count, stamp.sent);      
      this.stampButtonList.appendChild(button);
      this.stampButtonList.appendChild(document.createTextNode(' '));
    });
  }
  
  updateButton(button, count, sent) {
    button.querySelector('.shapoconet_stamp_count').innerHTML = count;
    if (sent) {
      button.classList.add('shapoconet_stamp_sent');
      button.title = 'スタンプを取り消す';
    }
    else {
      button.classList.remove('shapoconet_stamp_sent');
      button.title = 'スタンプを送る';
    }
  }
  
  stampClicked(button) {
    const emoji = button.querySelector('.shapoconet_stamp_emoji').innerHTML.trim();
    const remove = emoji in this.stamps ? this.stamps[emoji].sent : false;
    this.updateStamp(emoji, remove);
  }
  
  updateStamp(emoji, remove) {
    var params = {
      s: this.location,
      m: remove ? 'd' : 'a',
      k: emoji,
    };
    if (this.clientId) params['i'] = this.clientId;
    this.fetchApi(params)
      .then(resp => resp.json())
      .then(resp => { 
        if (this.isDebugMode) console.log(resp);
        this.procApiResponse(resp);
        if (resp.success) {
          this.updateButtons(false);
        }
      })
      .catch(error => {
        this.showMessage(false, '通信エラー');
      });
  }
  
  fetchApi(params) {
    const encodedParams = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    const url = `${ShapocoNetStamp.API_URL_BASE}/api.php?${encodedParams}`;
    if (this.isDebugMode) console.log(url);
    return fetch(url);
  }

  showPicker() {
    this.getPicker().style.display = 'block';
    this.setPickerPos();
    this.updateSendButtonStatus();
  }

  hidePicker() {
    this.getPicker().style.display = 'none';
  }

  onSendFromPicker() {
    this.updateStamp(this.inputBox.value, false);
    this.hidePicker();
  }

  getPicker() {
    if (!this.picker) {
      const picker = document.createElement('form');
      this.picker = picker;
      picker.classList.add('shapoconet_stamp_ui');
      picker.id = 'shapoconet_stamp_popup';
      picker.style.display = 'none';
      picker.style.zIndex = '999';
      var html = '';
      html += `<div>\n`;
      html += `<select id="shapoconet_stamp_popup_category" class="shapoconet_stamp_emoji"></select>`;
      html += `</div>\n`;
      html += `<div id="shapoconet_stamp_popup_list">\n`;
      html += `絵文字を読み込んでいます...\n`;
      html += `</div>\n`;
      html += `<div>\n`;
      html += `<input type="text" id="shapoconet_stamp_popup_input" class="shapoconet_stamp_emoji" style="box-sizing: border-box; width: 100%;">\n`;
      html += `</div>\n`;
      html += `<div style="text-align: right;">\n`;
      html += `<button type="button" id="shapoconet_stamp_picker_cancel">キャンセル</button>\n`;
      html += `<button type="button" id="shapoconet_stamp_picker_send" disabled="disabled">送信</button>\n`;
      html += `</div>\n`;
      picker.innerHTML = html;
      document.body.appendChild(picker);
      this.categoryList = picker.querySelector('#shapoconet_stamp_popup_category');
      this.emojiList = picker.querySelector('#shapoconet_stamp_popup_list');
      this.inputBox = picker.querySelector('#shapoconet_stamp_popup_input');
      this.sendButton = picker.querySelector('#shapoconet_stamp_picker_send');
      this.categoryList.addEventListener('change', evt => this.onStampCategoryChanged());
      this.inputBox.addEventListener('change', evt => this.updateSendButtonStatus());
      this.inputBox.addEventListener('keyup', evt => this.updateSendButtonStatus());
      this.sendButton.addEventListener('click', evt => this.onSendFromPicker());
      picker.querySelector('#shapoconet_stamp_picker_cancel').addEventListener('click', evt => this.hidePicker());
    }

    // document.body に appendChild してもすぐには表示サイズを取得できないので
    // アニメーションを要求する
    window.requestAnimationFrame(t => { this.setPickerPos(); });

    // emoji 辞書のロード
    fetch(`${ShapocoNetStamp.API_URL_BASE}/emoji16.0.json?${this.urlPostfix}`)
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
        this.picker.querySelector('#shapoconet_stamp_popup_category').innerHTML = html;
        this.onStampCategoryChanged();
        this.setPickerPos();
      })
      .catch(error => {
        this.emojiList.innerHTML = '通信エラー';
      });

    return this.picker;
  }

  updateSendButtonStatus() {
    this.sendButton.disabled = !(this.inputBox.value in this.emojiDict);
  }

  setPickerPos() {
    const buttonRect = this.addButton.getBoundingClientRect();
    const upperSpace = buttonRect.top;
    const lowerSpace = window.innerHeight - buttonRect.top + buttonRect.height;

    const pickerRect = this.picker.getBoundingClientRect();
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

    this.picker.style.position = 'position';
    this.picker.style.left = left + 'px';
    this.picker.style.top = top + 'px';
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
      link.classList.add('shapoconet_stamp_emoji');
      link.title = item.name;
      link.innerHTML = item.emoji;
      link.addEventListener('click', evt=>this.onStampSelected(link));
      this.emojiList.appendChild(link);
    });

  }

  onStampSelected(link) {
    this.inputBox.value = link.textContent;
    this.updateSendButtonStatus();
  }

  showMessage(success, message) {
    if (success) {
      this.statusMsg.style.display = 'none';
      this.statusMsg.innerHTML = '';
    }
    else {
      this.statusMsg.innerHTML = '⚠ ' + (message ? message : '不明なエラー');
      this.statusMsg.style.display = 'inline-block';
    }
  }
}

const shapocoNetStamp = new ShapocoNetStamp();
shapocoNetStamp.init();
