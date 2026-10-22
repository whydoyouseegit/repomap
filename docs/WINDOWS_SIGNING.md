# Цифровая подпись Windows

Выпуск 0.1.3 не подписан сертификатом. Поэтому Windows может показывать «Неизвестный издатель» или предупреждение SmartScreen. Имя автора в свойствах файла и собственная иконка не заменяют цифровую подпись.

Установщик не отключает SmartScreen, антивирус и другие средства защиты. Наличие файла в GitHub Release и совпадение SHA-256 подтверждают источник и целостность, но сами по себе не являются проверкой безопасности программы.

## Как проверить скачанный файл

Скачай `SHA256SUMS.txt` из того же релиза. Открой PowerShell в папке с установщиком:

```powershell
Get-FileHash .\Repo-Map-Setup-0.1.3-x64.exe -Algorithm SHA256
```

Сравни поле `Hash` со строкой для этого файла в `SHA256SUMS.txt`. Регистр букв не имеет значения.

## Как собрать подписанную версию

Нужен доверенный сертификат подписи кода. Добавь в GitHub → Settings → Secrets and variables → Actions:

- `WIN_CSC_LINK` — PFX-сертификат в base64 или поддерживаемая electron-builder ссылка;
- `WIN_CSC_KEY_PASSWORD` — пароль сертификата.

Запусти workflow **Build desktop apps** вручную и включи **signed_windows**. Этот режим требует сертификат и проверяет Authenticode. Для локальной сборки установи те же переменные окружения и выполни:

```sh
npm run build:win:signed
```

Сертификат и пароль не должны попадать в репозиторий. Подпись помогает подтвердить издателя, но не гарантирует немедленного исчезновения SmartScreen: учитывается и репутация файла/сертификата.

[Документация Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) · [Подпись в Electron](https://www.electronjs.org/docs/latest/tutorial/code-signing).
