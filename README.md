# Hediet Power Tools

[![](https://img.shields.io/static/v1?style=social&label=Sponsor&message=%E2%9D%A4&logo=GitHub&color&link=%3Curl%3E)](https://github.com/sponsors/hediet)
[![](https://img.shields.io/static/v1?style=social&label=Donate&message=%E2%9D%A4&logo=Paypal&color&link=%3Curl%3E)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZP5F38L4C88UY&source=url)
[![](https://img.shields.io/twitter/follow/hediet_dev.svg?style=social)](https://twitter.com/intent/follow?screen_name=hediet_dev)

This extension bundles various features that each are too small for a successful extension.

All features can be turned on and off individually!

## Provided Features (Turned On By Default)

<img align="right" src="docs/demo-apply-rename.gif" width="450">

### Apply Rename

-   Use `"hediet-power-tools.applyRename.enabled": false` to disable this feature.

Renames identifiers after you already changed them. Bound to shift+enter if identifier at cursor has changed.

This is incredible useful if combined with other multi cursor features. Should work for every language that has rename and word highlighting capabilities.

<details>
  <summary><b>Settings</b></summary>
  
-   `hediet-power-tools.applyRename.theme`: Configures a theme.

    -   `dashed`:

        ![](./docs/apply-rename-theme-dashed.png)
    -   `colored`:

        ![](./docs/apply-rename-theme-colored.png)

</details>

<br clear="right"/>
<br />

---

<img align="right" src="docs/stack-frame-line-highlighter.gif" width="450">

### Stack Frame Line Highlighter

-   Use `"hediet-power-tools.stackFrameLineHighlighter.enabled": false` to disable this feature.

By default, VS Code only highlights the currently executed line when debugging.
This feature also highlights all other lines in the call stack!

<br clear="right"/>
<br />

---

<img align="right" src="docs/json-escape-assistant.gif" width="450">

### JSON Escape Assistant

-   Use `"hediet-power-tools.jsonEscapeAssistant.enabled": false` to disable this feature.

The JSON Escape Assistant offers the following features:

-   Shows the unescaped value when hovering over a string in a JSON document
-   Provides options to copy and paste the unescaped values (_copy_ / _paste_ in the hover menu)
-   Provides a virtual unescaped string editor (_edit_ in the hover menu)

<br clear="right"/>

## Additional Features (Turned Off By Default)

### Custom Definitions

-   Use `"hediet-power-tools.customDefinitions.enabled": true` to enable this feature.

Add `/* def */` before an identifier and VS Code will treat this identifier as definition for all equal identifiers.
Useful if TypeScript screws up and gets the types wrong.

---

### DAP Logger

-   Use `"hediet-power-tools.debugAdapterLogger.enabled": true` to enable this feature.

Adds an output channel that logs all messages from and to the debug adapter.
Useful for debugging or evaluating what you can do with it.

## Planned Features (Not Implemented Yet)

-   Extend all selections until a selected character is found (inspired by `yo1dog.multi-cursor-search`).
-   Replace all selections with the result of a javascript function (inspired by `map-replace.js`).
-   Log Point Assistant
