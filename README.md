# Hediet Power Tools

[![](https://img.shields.io/static/v1?style=social&label=Sponsor&message=%E2%9D%A4&logo=GitHub&color&link=%3Curl%3E)](https://github.com/sponsors/hediet)
[![](https://img.shields.io/static/v1?style=social&label=Donate&message=%E2%9D%A4&logo=Paypal&color&link=%3Curl%3E)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZP5F38L4C88UY&source=url)
[![](https://img.shields.io/twitter/follow/hediet_dev.svg?style=social)](https://twitter.com/intent/follow?screen_name=hediet_dev)

This extension provides various helper commands.

All features can be turned on and off indidivually.

## Provided Features (Turned On By Default)

<img align="right" src="docs/demo-apply-rename.gif" width="450">

### Hediet Power Tools: Apply Rename

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

<img align="right" src="docs/stack-frame-line-highlighter.gif" width="450">

### Stack Frame Line Highlighter

-   Use `"hediet-power-tools.stackFrameLineHighlighter.enabled": false` to disable this feature.

By default, VS Code only highlights the currently executed line when debugging.
This feature also highlights all other lines in the call stack!

<br clear="right"/>

## Additional Features (Turned Off By Default)

### Custom Definitions

-   Use `"hediet-power-tools.customDefinitions.enabled": true` to enable this feature.

Add `/* def */` before an identifier and VS Code will treat this identifier as definition for all equal identifiers.

### DAP Logger

-   Use `"hediet-power-tools.debugAdapterLogger.enabled": true` to enable this feature.

Adds an output channel that logs all messages from and to the debug adapter.

## Planned Features (Not Implemented Yet)

-   Extend all selections until a selected character is found (inspired by `yo1dog.multi-cursor-search`).
-   Replace all selections with the result of a javascript function (inspired by `map-replace.js`).
-   Investigate JSON auto escaping when copying/pasting windows file names.
