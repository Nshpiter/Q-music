!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var QMusic.CreateDesktopShortcut
  Var QMusic.DesktopShortcutCheckbox
!endif

!macro customInit
  StrCpy $QMusic.CreateDesktopShortcut "0"
  ${StdUtils.TestParameter} $R9 "create-desktop-shortcut"
  StrCmp "$R9" "true" 0 +2
  StrCpy $QMusic.CreateDesktopShortcut "1"
!macroend

!macro customPageAfterChangeDir
  !insertmacro MUI_PAGE_INIT
  !insertmacro QMusicShortcutOptionsFunctions QMusic.ShortcutOptionsPre_${MUI_UNIQUEID} QMusic.ShortcutOptionsLeave_${MUI_UNIQUEID}

  PageEx custom
    PageCallbacks QMusic.ShortcutOptionsPre_${MUI_UNIQUEID} QMusic.ShortcutOptionsLeave_${MUI_UNIQUEID}
    Caption " "
  PageExEnd
!macroend

!macro QMusicShortcutOptionsFunctions PRE LEAVE
  Function "${PRE}"
    ${if} ${isUpdated}
      Abort
    ${endif}

    !insertmacro MUI_HEADER_TEXT "安装选项" "选择安装完成后需要创建的快捷方式。"
    nsDialogs::Create 1018
    Pop $0

    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 300u 24u "选择附加任务："
    Pop $1

    ${NSD_CreateCheckbox} 10u 34u 280u 18u "创建桌面快捷方式"
    Pop $QMusic.DesktopShortcutCheckbox

    ${If} $QMusic.CreateDesktopShortcut == "1"
      SendMessage $QMusic.DesktopShortcutCheckbox ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $QMusic.DesktopShortcutCheckbox ${BM_SETCHECK} 0 0
    ${EndIf}

    ${NSD_CreateLabel} 10u 64u 280u 40u "默认不创建桌面快捷方式；需要桌面图标时勾选即可。"
    Pop $1

    nsDialogs::Show
  FunctionEnd

  Function "${LEAVE}"
    SendMessage $QMusic.DesktopShortcutCheckbox ${BM_GETCHECK} 0 0 $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $QMusic.CreateDesktopShortcut "1"
    ${Else}
      StrCpy $QMusic.CreateDesktopShortcut "0"
    ${EndIf}
  FunctionEnd
!macroend

!macro customInstall
  ${If} $QMusic.CreateDesktopShortcut == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend

!macro customUnInstall
  WinShell::UninstShortcut "$oldDesktopLink"
  Delete "$oldDesktopLink"
!macroend
