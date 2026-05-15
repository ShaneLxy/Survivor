# 云境音频资源目录

后续新增音频时，推荐按下面结构放置：

```text
assets/audio/
  bgm/
    yunjing_theme_demo.wav
  voice/
    hero_010/
      select.wav
      battle_start.wav
    hero_024/
      select.wav
      battle_start.wav
```

放入文件后，在 `js/config/AudioConfig.js` 中登记 `src` 即可播放。

常用调用：

```js
audioManager.playMusic('yunjing_theme');
audioManager.playSceneBgm('shelter');
audioManager.playHeroVoice('hero_010', 'select');
audioManager.playHeroVoice('hero_024', 'battleStart');
audioManager.setMusicVolume(0.45);
audioManager.setVoiceVolume(0.85);
```

当前目录中的试听语音为合成占位音频，用于验证播放链路和游戏内音量氛围，正式上线前建议替换为真人或专业 TTS 配音。
