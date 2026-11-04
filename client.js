/**
 * Browser half of the host file-explorer bundle.
 *
 * The page opens from a left-sidebar entry and shows the machine's filesystem:
 * a directory listing with the entries' kinds and sizes, a preview pane for
 * text files, and one action that creates a directory. Every read crosses the
 * Host/Client Remote boundary through the namespace this half mounts, so the
 * page never touches the filesystem itself.
 *
 * The module contributes two slot entries: the sidebar button that opens the
 * panel, and the panel itself. Both are named by one panel id, which is how
 * the sidebar knows which main panel a button opens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-host-file-explorer',
  factory(require) {
    const React = require('react');
    const z = require('zod');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** The locale namespace this half's dictionary registers under. */
    const NS = 'hostFileExplorer';

    /** The panel id: the sidebar button and the main panel share it. */
    const PANEL_ID = 'host-files';

    /** The Remote namespace the Host half exposes. */
    const NAMESPACE = 'hostFiles';

    /**
     * The Cordis service key of that namespace.
     *
     * The mounted namespace is a service of its own, and the plugin that mounts
     * it cannot declare it as an inject: the service appears only after this
     * plugin's mount has run, so a fiber waiting for it would never wake up.
     * `ctx.get` reads a service straight from the shared store instead.
     */
    const NAMESPACE_KEY = `remote.${NAMESPACE}`;

    /**
     * The strings the page shows, one dictionary per language.
     *
     * Every visible string lives here and nowhere else: the panel asks the
     * locale service for a key, and the service resolves that key against the
     * active language's fallback chain, so a language that ships no dictionary
     * still reads English rather than showing a raw key.
     */
    const DICTIONARIES = {
      en: {
        'panel': 'Files',
        'page.title': 'Host files',
        'page.intro': 'Browse the filesystem of the machine running this Harness.',
        'action.home': 'Home',
        'action.up': 'Up',
        'action.refresh': 'Refresh',
        'action.go': 'Open',
        'action.newFolder': 'New folder',
        'action.create': 'Create',
        'action.cancel': 'Cancel',
        'action.download': 'Download',
        'action.upload': 'Upload',
        'label.path': 'Path',
        'label.name': 'Name',
        'label.kind': 'Kind',
        'label.size': 'Size',
        'label.modified': 'Modified',
        'label.folderName': 'Folder name',
        'label.preview': 'Preview',
        'label.noPreview': 'Select a file to preview its contents.',
        'label.binary': 'This file is not text; no preview is available.',
        'label.truncated': 'Only the first part of this file is shown.',
        'label.imageFailed': 'This image could not be displayed.',
        'label.tooLarge': 'This file is larger than one download may carry.',
        'label.uploadHint': 'Uploaded files are written into the directory shown below.',
        'label.uploadTooLarge': 'This file is larger than one upload may carry.',
        'label.uploaded': 'Uploaded {count} file(s).',
        'state.loading': 'Reading the directory…',
        'state.empty': 'This directory is empty.',
        'state.truncated': 'This directory holds more entries than are listed.',
        'state.uploading': 'Uploading…',
        'error.title': 'The directory could not be read.',
        'error.create': 'The directory could not be created.',
        'error.upload': 'The file could not be uploaded.',
      },
      zh: {
        'panel': '文件',
        'page.title': '宿主机文件',
        'page.intro': '浏览运行本 Harness 的机器上的文件系统。',
        'action.home': '主目录',
        'action.up': '上一级',
        'action.refresh': '刷新',
        'action.go': '打开',
        'action.newFolder': '新建文件夹',
        'action.create': '创建',
        'action.cancel': '取消',
        'action.download': '下载',
        'action.upload': '上传',
        'label.path': '路径',
        'label.name': '名称',
        'label.kind': '类型',
        'label.size': '大小',
        'label.modified': '修改时间',
        'label.folderName': '文件夹名称',
        'label.preview': '预览',
        'label.noPreview': '选择一个文件以预览其内容。',
        'label.binary': '该文件不是文本，无法预览。',
        'label.truncated': '仅显示了该文件的前一部分内容。',
        'label.imageFailed': '无法显示该图片。',
        'label.tooLarge': '该文件超过单次下载的大小上限。',
        'label.uploadHint': '上传的文件会写入下方显示的目录。',
        'label.uploadTooLarge': '该文件超过单次上传的大小上限。',
        'label.uploaded': '已上传 {count} 个文件。',
        'state.loading': '正在读取目录…',
        'state.empty': '该目录为空。',
        'state.truncated': '该目录的条目多于已列出的数量。',
        'state.uploading': '正在上传…',
        'error.title': '无法读取该目录。',
        'error.create': '无法创建该目录。',
        'error.upload': '无法上传该文件。',
      },
      'zh-TW': {
        'panel': '檔案',
        'page.title': '主機檔案',
        'page.intro': '瀏覽執行本 Harness 的機器上的檔案系統。',
        'action.home': '主目錄',
        'action.up': '上一層',
        'action.refresh': '重新整理',
        'action.go': '開啟',
        'action.newFolder': '新增資料夾',
        'action.create': '建立',
        'action.cancel': '取消',
        'action.download': '下載',
        'action.upload': '上傳',
        'label.path': '路徑',
        'label.name': '名稱',
        'label.kind': '類型',
        'label.size': '大小',
        'label.modified': '修改時間',
        'label.folderName': '資料夾名稱',
        'label.preview': '預覽',
        'label.noPreview': '選擇一個檔案以預覽其內容。',
        'label.binary': '該檔案不是文字，無法預覽。',
        'label.truncated': '僅顯示了該檔案的前一部分內容。',
        'label.imageFailed': '無法顯示該圖片。',
        'label.tooLarge': '該檔案超過單次下載的大小上限。',
        'label.uploadHint': '上傳的檔案會寫入下方顯示的目錄。',
        'label.uploadTooLarge': '該檔案超過單次上傳的大小上限。',
        'label.uploaded': '已上傳 {count} 個檔案。',
        'state.loading': '正在讀取目錄…',
        'state.empty': '該目錄為空。',
        'state.truncated': '該目錄的項目多於已列出的數量。',
        'state.uploading': '正在上傳…',
        'error.title': '無法讀取該目錄。',
        'error.create': '無法建立該目錄。',
        'error.upload': '無法上傳該檔案。',
      },
      ja: {
        'panel': 'ファイル',
        'page.title': 'ホストファイル',
        'page.intro': 'この Harness が動作しているマシンのファイルシステムを閲覧します。',
        'action.home': 'ホーム',
        'action.up': '上へ',
        'action.refresh': '更新',
        'action.go': '開く',
        'action.newFolder': '新しいフォルダ',
        'action.create': '作成',
        'action.cancel': 'キャンセル',
        'action.download': 'ダウンロード',
        'action.upload': 'アップロード',
        'label.path': 'パス',
        'label.name': '名前',
        'label.kind': '種類',
        'label.size': 'サイズ',
        'label.modified': '更新日時',
        'label.folderName': 'フォルダ名',
        'label.preview': 'プレビュー',
        'label.noPreview': 'ファイルを選ぶと内容をプレビューします。',
        'label.binary': 'このファイルはテキストではないためプレビューできません。',
        'label.truncated': 'ファイルの先頭部分のみ表示しています。',
        'label.imageFailed': 'この画像は表示できませんでした。',
        'label.tooLarge': 'このファイルは 1 回のダウンロードの上限を超えています。',
        'label.uploadHint': 'アップロードしたファイルは下に表示されているディレクトリに書き込まれます。',
        'label.uploadTooLarge': 'このファイルは 1 回のアップロードの上限を超えています。',
        'label.uploaded': '{count} 件のファイルをアップロードしました。',
        'state.loading': 'ディレクトリを読み込んでいます…',
        'state.empty': 'このディレクトリは空です。',
        'state.truncated': 'このディレクトリには表示された数より多くの項目があります。',
        'state.uploading': 'アップロードしています…',
        'error.title': 'ディレクトリを読み込めませんでした。',
        'error.create': 'ディレクトリを作成できませんでした。',
        'error.upload': 'ファイルをアップロードできませんでした。',
      },
      ko: {
        'panel': '파일',
        'page.title': '호스트 파일',
        'page.intro': '이 Harness가 실행 중인 컴퓨터의 파일 시스템을 살펴봅니다.',
        'action.home': '홈',
        'action.up': '상위 폴더',
        'action.refresh': '새로 고침',
        'action.go': '열기',
        'action.newFolder': '새 폴더',
        'action.create': '만들기',
        'action.cancel': '취소',
        'action.download': '다운로드',
        'action.upload': '업로드',
        'label.path': '경로',
        'label.name': '이름',
        'label.kind': '유형',
        'label.size': '크기',
        'label.modified': '수정 시간',
        'label.folderName': '폴더 이름',
        'label.preview': '미리 보기',
        'label.noPreview': '파일을 선택하면 내용을 미리 봅니다.',
        'label.binary': '텍스트가 아닌 파일이라 미리 볼 수 없습니다.',
        'label.truncated': '파일의 앞부분만 표시합니다.',
        'label.imageFailed': '이 이미지를 표시할 수 없습니다.',
        'label.tooLarge': '이 파일은 한 번의 다운로드 한도를 넘습니다.',
        'label.uploadHint': '업로드한 파일은 아래에 표시된 디렉터리에 기록됩니다.',
        'label.uploadTooLarge': '이 파일은 한 번의 업로드 한도를 넘습니다.',
        'label.uploaded': '파일 {count}개를 업로드했습니다.',
        'state.loading': '디렉터리를 읽는 중…',
        'state.empty': '이 디렉터리는 비어 있습니다.',
        'state.truncated': '이 디렉터리에는 표시된 것보다 많은 항목이 있습니다.',
        'state.uploading': '업로드하는 중…',
        'error.title': '디렉터리를 읽을 수 없습니다.',
        'error.create': '디렉터리를 만들 수 없습니다.',
        'error.upload': '파일을 업로드할 수 없습니다.',
      },
      fr: {
        'panel': 'Fichiers',
        'page.title': 'Fichiers de l’hôte',
        'page.intro': 'Parcourir le système de fichiers de la machine qui exécute ce Harness.',
        'action.home': 'Dossier personnel',
        'action.up': 'Parent',
        'action.refresh': 'Actualiser',
        'action.go': 'Ouvrir',
        'action.newFolder': 'Nouveau dossier',
        'action.create': 'Créer',
        'action.cancel': 'Annuler',
        'action.download': 'Télécharger',
        'action.upload': 'Téléverser',
        'label.path': 'Chemin',
        'label.name': 'Nom',
        'label.kind': 'Type',
        'label.size': 'Taille',
        'label.modified': 'Modifié',
        'label.folderName': 'Nom du dossier',
        'label.preview': 'Aperçu',
        'label.noPreview': 'Sélectionnez un fichier pour en voir le contenu.',
        'label.binary': 'Ce fichier n’est pas du texte ; aucun aperçu n’est possible.',
        'label.truncated': 'Seule la première partie de ce fichier est affichée.',
        'label.imageFailed': 'Cette image n’a pas pu être affichée.',
        'label.tooLarge': 'Ce fichier dépasse la limite d’un téléchargement.',
        'label.uploadHint': 'Les fichiers téléversés sont écrits dans le dossier affiché ci-dessous.',
        'label.uploadTooLarge': 'Ce fichier dépasse la limite d’un téléversement.',
        'label.uploaded': '{count} fichier(s) téléversé(s).',
        'state.loading': 'Lecture du dossier…',
        'state.empty': 'Ce dossier est vide.',
        'state.truncated': 'Ce dossier contient plus d’éléments que ceux listés.',
        'state.uploading': 'Téléversement…',
        'error.title': 'Le dossier n’a pas pu être lu.',
        'error.create': 'Le dossier n’a pas pu être créé.',
        'error.upload': 'Le fichier n’a pas pu être téléversé.',
      },
      de: {
        'panel': 'Dateien',
        'page.title': 'Host-Dateien',
        'page.intro': 'Das Dateisystem des Rechners durchsuchen, auf dem dieses Harness läuft.',
        'action.home': 'Persönlicher Ordner',
        'action.up': 'Übergeordnet',
        'action.refresh': 'Aktualisieren',
        'action.go': 'Öffnen',
        'action.newFolder': 'Neuer Ordner',
        'action.create': 'Anlegen',
        'action.cancel': 'Abbrechen',
        'action.download': 'Herunterladen',
        'action.upload': 'Hochladen',
        'label.path': 'Pfad',
        'label.name': 'Name',
        'label.kind': 'Art',
        'label.size': 'Größe',
        'label.modified': 'Geändert',
        'label.folderName': 'Ordnername',
        'label.preview': 'Vorschau',
        'label.noPreview': 'Wählen Sie eine Datei, um ihren Inhalt zu sehen.',
        'label.binary': 'Diese Datei ist kein Text; eine Vorschau ist nicht möglich.',
        'label.truncated': 'Nur der erste Teil dieser Datei wird angezeigt.',
        'label.imageFailed': 'Dieses Bild konnte nicht angezeigt werden.',
        'label.tooLarge': 'Diese Datei ist größer als ein Download tragen darf.',
        'label.uploadHint': 'Hochgeladene Dateien werden in den unten angezeigten Ordner geschrieben.',
        'label.uploadTooLarge': 'Diese Datei ist größer als ein Upload tragen darf.',
        'label.uploaded': '{count} Datei(en) hochgeladen.',
        'state.loading': 'Ordner wird gelesen…',
        'state.empty': 'Dieser Ordner ist leer.',
        'state.truncated': 'Dieser Ordner enthält mehr Einträge als aufgelistet sind.',
        'state.uploading': 'Wird hochgeladen…',
        'error.title': 'Der Ordner konnte nicht gelesen werden.',
        'error.create': 'Der Ordner konnte nicht angelegt werden.',
        'error.upload': 'Die Datei konnte nicht hochgeladen werden.',
      },
      es: {
        'panel': 'Archivos',
        'page.title': 'Archivos del host',
        'page.intro': 'Explora el sistema de archivos de la máquina que ejecuta este Harness.',
        'action.home': 'Inicio',
        'action.up': 'Subir',
        'action.refresh': 'Actualizar',
        'action.go': 'Abrir',
        'action.newFolder': 'Nueva carpeta',
        'action.create': 'Crear',
        'action.cancel': 'Cancelar',
        'action.download': 'Descargar',
        'action.upload': 'Subir',
        'label.path': 'Ruta',
        'label.name': 'Nombre',
        'label.kind': 'Tipo',
        'label.size': 'Tamaño',
        'label.modified': 'Modificado',
        'label.folderName': 'Nombre de la carpeta',
        'label.preview': 'Vista previa',
        'label.noPreview': 'Selecciona un archivo para ver su contenido.',
        'label.binary': 'Este archivo no es texto; no hay vista previa.',
        'label.truncated': 'Solo se muestra la primera parte de este archivo.',
        'label.imageFailed': 'No se pudo mostrar esta imagen.',
        'label.tooLarge': 'Este archivo supera el límite de una descarga.',
        'label.uploadHint': 'Los archivos subidos se escriben en el directorio que se muestra abajo.',
        'label.uploadTooLarge': 'Este archivo supera el límite de una subida.',
        'label.uploaded': 'Se subieron {count} archivo(s).',
        'state.loading': 'Leyendo el directorio…',
        'state.empty': 'Este directorio está vacío.',
        'state.truncated': 'Este directorio tiene más entradas de las que se muestran.',
        'state.uploading': 'Subiendo…',
        'error.title': 'No se pudo leer el directorio.',
        'error.create': 'No se pudo crear el directorio.',
        'error.upload': 'No se pudo subir el archivo.',
      },
      ru: {
        'panel': 'Файлы',
        'page.title': 'Файлы хоста',
        'page.intro': 'Просмотр файловой системы машины, на которой работает этот Harness.',
        'action.home': 'Домашний каталог',
        'action.up': 'Вверх',
        'action.refresh': 'Обновить',
        'action.go': 'Открыть',
        'action.newFolder': 'Новая папка',
        'action.create': 'Создать',
        'action.cancel': 'Отмена',
        'action.download': 'Скачать',
        'action.upload': 'Загрузить',
        'label.path': 'Путь',
        'label.name': 'Имя',
        'label.kind': 'Тип',
        'label.size': 'Размер',
        'label.modified': 'Изменён',
        'label.folderName': 'Имя папки',
        'label.preview': 'Просмотр',
        'label.noPreview': 'Выберите файл, чтобы посмотреть его содержимое.',
        'label.binary': 'Это не текстовый файл, просмотр недоступен.',
        'label.truncated': 'Показана только первая часть файла.',
        'label.imageFailed': 'Не удалось показать это изображение.',
        'label.tooLarge': 'Этот файл больше, чем может нести одна загрузка.',
        'label.uploadHint': 'Загруженные файлы записываются в каталог, показанный ниже.',
        'label.uploadTooLarge': 'Этот файл больше, чем может нести одна отправка.',
        'label.uploaded': 'Загружено файлов: {count}.',
        'state.loading': 'Чтение каталога…',
        'state.empty': 'Каталог пуст.',
        'state.truncated': 'В каталоге больше элементов, чем показано.',
        'state.uploading': 'Загрузка…',
        'error.title': 'Не удалось прочитать каталог.',
        'error.create': 'Не удалось создать каталог.',
        'error.upload': 'Не удалось загрузить файл.',
      },
      'pt-BR': {
        'panel': 'Arquivos',
        'page.title': 'Arquivos do host',
        'page.intro': 'Explore o sistema de arquivos da máquina que executa este Harness.',
        'action.home': 'Início',
        'action.up': 'Acima',
        'action.refresh': 'Atualizar',
        'action.go': 'Abrir',
        'action.newFolder': 'Nova pasta',
        'action.create': 'Criar',
        'action.cancel': 'Cancelar',
        'action.download': 'Baixar',
        'action.upload': 'Enviar',
        'label.path': 'Caminho',
        'label.name': 'Nome',
        'label.kind': 'Tipo',
        'label.size': 'Tamanho',
        'label.modified': 'Modificado',
        'label.folderName': 'Nome da pasta',
        'label.preview': 'Pré-visualização',
        'label.noPreview': 'Selecione um arquivo para ver o conteúdo.',
        'label.binary': 'Este arquivo não é texto; não há pré-visualização.',
        'label.truncated': 'Apenas a primeira parte deste arquivo é exibida.',
        'label.imageFailed': 'Não foi possível exibir esta imagem.',
        'label.tooLarge': 'Este arquivo é maior do que um download pode carregar.',
        'label.uploadHint': 'Os arquivos enviados são gravados no diretório mostrado abaixo.',
        'label.uploadTooLarge': 'Este arquivo é maior do que um envio pode carregar.',
        'label.uploaded': '{count} arquivo(s) enviado(s).',
        'state.loading': 'Lendo o diretório…',
        'state.empty': 'Este diretório está vazio.',
        'state.truncated': 'Este diretório tem mais entradas do que as listadas.',
        'state.uploading': 'Enviando…',
        'error.title': 'Não foi possível ler o diretório.',
        'error.create': 'Não foi possível criar o diretório.',
        'error.upload': 'Não foi possível enviar o arquivo.',
      },
      it: {
        'panel': 'File',
        'page.title': 'File dell’host',
        'page.intro': 'Sfoglia il file system della macchina che esegue questo Harness.',
        'action.home': 'Cartella home',
        'action.up': 'Superiore',
        'action.refresh': 'Aggiorna',
        'action.go': 'Apri',
        'action.newFolder': 'Nuova cartella',
        'action.create': 'Crea',
        'action.cancel': 'Annulla',
        'action.download': 'Scarica',
        'action.upload': 'Carica',
        'label.path': 'Percorso',
        'label.name': 'Nome',
        'label.kind': 'Tipo',
        'label.size': 'Dimensione',
        'label.modified': 'Modificato',
        'label.folderName': 'Nome della cartella',
        'label.preview': 'Anteprima',
        'label.noPreview': 'Seleziona un file per vederne il contenuto.',
        'label.binary': 'Questo file non è di testo; non c’è anteprima.',
        'label.truncated': 'È mostrata solo la prima parte di questo file.',
        'label.imageFailed': 'Non è stato possibile mostrare questa immagine.',
        'label.tooLarge': 'Questo file supera il limite di un download.',
        'label.uploadHint': 'I file caricati vengono scritti nella cartella mostrata sotto.',
        'label.uploadTooLarge': 'Questo file supera il limite di un caricamento.',
        'label.uploaded': 'Caricati {count} file.',
        'state.loading': 'Lettura della cartella…',
        'state.empty': 'Questa cartella è vuota.',
        'state.truncated': 'Questa cartella contiene più voci di quante ne siano elencate.',
        'state.uploading': 'Caricamento…',
        'error.title': 'Impossibile leggere la cartella.',
        'error.create': 'Impossibile creare la cartella.',
        'error.upload': 'Impossibile caricare il file.',
      },
      tr: {
        'panel': 'Dosyalar',
        'page.title': 'Host dosyaları',
        'page.intro': 'Bu Harness’in çalıştığı makinenin dosya sistemine göz atın.',
        'action.home': 'Ev dizini',
        'action.up': 'Üst dizin',
        'action.refresh': 'Yenile',
        'action.go': 'Aç',
        'action.newFolder': 'Yeni klasör',
        'action.create': 'Oluştur',
        'action.cancel': 'Vazgeç',
        'action.download': 'İndir',
        'action.upload': 'Yükle',
        'label.path': 'Yol',
        'label.name': 'Ad',
        'label.kind': 'Tür',
        'label.size': 'Boyut',
        'label.modified': 'Değiştirilme',
        'label.folderName': 'Klasör adı',
        'label.preview': 'Önizleme',
        'label.noPreview': 'İçeriğini görmek için bir dosya seçin.',
        'label.binary': 'Bu dosya metin değil; önizleme yok.',
        'label.truncated': 'Yalnızca bu dosyanın ilk bölümü gösteriliyor.',
        'label.imageFailed': 'Bu görsel gösterilemedi.',
        'label.tooLarge': 'Bu dosya tek bir indirmenin taşıyabileceğinden büyük.',
        'label.uploadHint': 'Yüklenen dosyalar aşağıda gösterilen dizine yazılır.',
        'label.uploadTooLarge': 'Bu dosya tek bir yüklemenin taşıyabileceğinden büyük.',
        'label.uploaded': '{count} dosya yüklendi.',
        'state.loading': 'Dizin okunuyor…',
        'state.empty': 'Bu dizin boş.',
        'state.truncated': 'Bu dizinde listelenenden daha fazla öğe var.',
        'state.uploading': 'Yükleniyor…',
        'error.title': 'Dizin okunamadı.',
        'error.create': 'Dizin oluşturulamadı.',
        'error.upload': 'Dosya yüklenemedi.',
      },
    };

    /**
     * The languages this panel adds to the Harness's own language list.
     *
     * English and Chinese ship with the Harness, so only the rest are added
     * here. Each one names the language it falls back to, and every chain ends
     * at English, which is what the locale service requires of a language that
     * joins the catalog. A language another plugin already offered is left
     * alone: the dictionary still applies, and the catalog keeps one entry.
     */
    const LANGUAGES = [
      { id: 'zh-TW', label: '繁體中文', fallback: 'zh' },
      { id: 'ja', label: '日本語', fallback: 'en' },
      { id: 'ko', label: '한국어', fallback: 'en' },
      { id: 'fr', label: 'Français', fallback: 'en' },
      { id: 'de', label: 'Deutsch', fallback: 'en' },
      { id: 'es', label: 'Español', fallback: 'en' },
      { id: 'ru', label: 'Русский', fallback: 'en' },
      { id: 'pt-BR', label: 'Português (Brasil)', fallback: 'en' },
      { id: 'it', label: 'Italiano', fallback: 'en' },
      { id: 'tr', label: 'Türkçe', fallback: 'en' },
    ];

    /** One entry of a directory listing. */
    const entrySchema = z.object({
      name: z.string(),
      path: z.string(),
      kind: z.enum(['file', 'directory', 'other']),
      size: z.number().optional(),
      modified: z.number().optional(),
      mime: z.string().optional(),
      hidden: z.boolean(),
    });

    /** The result of one directory listing. */
    const listingSchema = z.object({
      path: z.string(),
      parent: z.string().nullable(),
      home: z.string(),
      entries: z.array(entrySchema),
      truncated: z.boolean(),
    });

    /**
     * The Remote contribution this half mounts: the Host service's verbs, with
     * the wire fields their arguments travel under.
     */
    const REMOTE = {
      package: '@local/dsh-host-file-explorer',
      descriptors: [
        {
          id: '@local/dsh-host-file-explorer#hostFiles/roots',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'roots',
          invocation: { kind: 'direct' },
          parameters: [],
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/roots:result',
            create: () => z.array(z.string()),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/list',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'list',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/list:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/list:result',
            create: () => listingSchema,
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/stat',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'stat',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/stat:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/stat:result',
            create: () => z.object({
              path: z.string(),
              kind: z.enum(['file', 'directory', 'other']),
              size: z.number().optional(),
              modified: z.number().optional(),
              mime: z.string().optional(),
            }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/read',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'read',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/read:path',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/read:result',
            create: () => z.object({
              path: z.string(),
              size: z.number(),
              modified: z.number().optional(),
              binary: z.boolean(),
              truncated: z.boolean(),
              text: z.string(),
            }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/mkdir',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'mkdir',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:path',
                create: () => z.string(),
              },
            },
            {
              name: 'name',
              wire: 'name',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:name',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/mkdir:result',
            create: () => z.object({ path: z.string() }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/upload',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'upload',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'path',
              wire: 'path',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/upload:path',
                create: () => z.string(),
              },
            },
            {
              name: 'name',
              wire: 'name',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/upload:name',
                create: () => z.string(),
              },
            },
            {
              name: 'data',
              wire: 'data',
              source: 'json',
              codec: {
                mode: 'strict',
                typeSymbol: '@local/dsh-host-file-explorer#hostFiles/upload:data',
                create: () => z.string(),
              },
            },
          ],
          cancellation: { parameter: 'signal' },
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/upload:result',
            create: () => z.object({ path: z.string(), size: z.number() }),
          },
        },
        {
          id: '@local/dsh-host-file-explorer#hostFiles/limits',
          service: NAMESPACE,
          namespace: NAMESPACE,
          method: 'limits',
          invocation: { kind: 'direct' },
          parameters: [],
          result: {
            mode: 'strict',
            typeSymbol: '@local/dsh-host-file-explorer#hostFiles/limits:result',
            create: () => z.object({ maxBytes: z.number() }),
          },
        },
      ],
    };

    /** One byte count, in the unit a reader expects. */
    function formatBytes(size) {
      if (typeof size !== 'number' || !Number.isFinite(size)) return '';
      if (size < 1024) return `${size} B`;
      const units = ['KiB', 'MiB', 'GiB', 'TiB'];
      let value = size / 1024;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
    }

    /** One modification time, in the reader's own locale. */
    function formatTime(modified) {
      if (typeof modified !== 'number' || !Number.isFinite(modified)) return '';
      return new Date(modified).toLocaleString();
    }

    /**
     * The address one host file is served under.
     *
     * The Harness serves host files to the page over its own authenticated
     * file route, so the browser may fetch the bytes with the same session the
     * page already holds. The route answers with the file's own content type,
     * which is what lets an image be shown and a download keep its name.
     *
     * @param path - the absolute host path.
     * @returns the file's URL, or undefined when the page has no address base.
     */
    function fileUrl(path) {
      if (typeof document === 'undefined') return undefined;
      const base = document.baseURI;
      if (typeof base !== 'string' || base.length === 0) return undefined;
      return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
    }

    /**
     * One file's bytes, as canonical base64.
     *
     * The Host admits the same canonical base64 the Harness's own attachment
     * endpoints admit, and the conversion runs in slices: one call to
     * `String.fromCharCode` over a whole file would blow the argument limit
     * long before the file itself is large.
     *
     * @param file - the file the browser picked.
     * @returns the file's bytes, base64 encoded.
     */
    async function readAsBase64(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      const slice = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += slice) {
        binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + slice));
      }
      return btoa(binary);
    }

    /**
     * The image extensions the page renders inline.
     *
     * The Host names each file's content type; this table only answers for a
     * file the Host named no type for.
     */
    const IMAGE_EXTENSIONS = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tif', 'tiff', 'heic',
    ]);

    /**
     * Whether one file can be shown as an image.
     *
     * The Host names each file's content type, and the browser's file route
     * serves the same type. When the Host named none, the extension decides,
     * so a picture still previews while the Host half catches up.
     *
     * @param mime - the content type the Host reported, if any.
     * @param name - the file name.
     * @returns true when the browser may render the file inline.
     */
    function isImage(mime, name) {
      if (typeof mime === 'string' && mime.length > 0) return mime.startsWith('image/');
      const extension = String(name ?? '').split('.').pop()?.toLowerCase() ?? '';
      return IMAGE_EXTENSIONS.has(extension);
    }

    /** The sidebar's button glyph: a folder, filled while its panel is open. */
    function FileExplorerIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18;
      const fill = props.active === true
        ? 'var(--dsw-alias-brand-primary)'
        : 'var(--dsw-alias-label-secondary)';
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      }, h('path', {
        d: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2c.4 0 .78.16 1.06.44L11.5 7.2h8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z',
        fill,
      }));
    }

    /** The panel: the directory listing beside the preview of one file. */
    function FileExplorerPage(props) {
      const t = props.t;
      const api = props.api;
      const [directory, setDirectory] = useState('');
      const [input, setInput] = useState('');
      const [listing, setListing] = useState(null);
      const [status, setStatus] = useState('loading');
      const [error, setError] = useState('');
      const [roots, setRoots] = useState([]);
      const [selected, setSelected] = useState(null);
      const [preview, setPreview] = useState(null);
      const [previewStatus, setPreviewStatus] = useState('idle');
      const [folderName, setFolderName] = useState('');
      const [creating, setCreating] = useState(false);
      const [createError, setCreateError] = useState('');
      const [revision, setRevision] = useState(0);
      const [maxBytes, setMaxBytes] = useState(null);
      const [imageFailed, setImageFailed] = useState(false);
      const [uploading, setUploading] = useState(false);
      const [uploadNote, setUploadNote] = useState('');
      const [uploadFailed, setUploadFailed] = useState(false);
      const listingRequest = useRef(0);
      const previewRequest = useRef(0);
      const fileInput = useRef(null);

      useEffect(() => {
        let cancelled = false;
        api.roots().then((paths) => {
          if (!cancelled) setRoots(paths);
        }).catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [api]);

      useEffect(() => {
        let cancelled = false;
        api.limits().then((result) => {
          if (!cancelled) setMaxBytes(result.maxBytes);
        }).catch(() => {});
        return () => {
          cancelled = true;
        };
      }, [api]);

      useEffect(() => {
        const request = ++listingRequest.current;
        setStatus('loading');
        setError('');
        api.list(directory).then((result) => {
          if (request !== listingRequest.current) return;
          setListing(result);
          setInput(result.path);
          setStatus('ready');
        }).catch((cause) => {
          if (request !== listingRequest.current) return;
          setListing(null);
          setStatus('error');
          setError(cause?.message ?? String(cause));
        });
      }, [api, directory, revision]);

      const open = useCallback((path) => {
        setDirectory(path);
        setSelected(null);
        setPreview(null);
        setPreviewStatus('idle');
      }, []);

      const refresh = useCallback(() => {
        setRevision((value) => value + 1);
      }, []);

      const select = useCallback((entry) => {
        setSelected(entry);
        setPreview(null);
        setImageFailed(false);
        if (entry.kind !== 'file') {
          setPreviewStatus('idle');
          return;
        }
        const request = ++previewRequest.current;
        if (isImage(entry.mime, entry.name)) {
          setPreviewStatus('image');
          return;
        }
        setPreviewStatus('loading');
        api.read(entry.path).then((result) => {
          if (request !== previewRequest.current) return;
          setPreview(result);
          setPreviewStatus('ready');
        }).catch((cause) => {
          if (request !== previewRequest.current) return;
          setPreview(null);
          setPreviewStatus('error');
          setError(cause?.message ?? String(cause));
        });
      }, [api]);

      const createFolder = useCallback(() => {
        const name = folderName.trim();
        if (name === '') return;
        setCreating(true);
        setCreateError('');
        api.mkdir(directory, name).then(() => {
          setFolderName('');
          setCreating(false);
          refresh();
        }).catch((cause) => {
          setCreating(false);
          setCreateError(cause?.message ?? String(cause));
        });
      }, [api, directory, folderName, refresh]);

      /**
       * Hand the files the browser picked to the host.
       *
       * Each file becomes one Remote call carrying its bytes as base64, which
       * is the same wire form the Harness's own attachment endpoints use. A
       * file that is larger than one upload may carry is refused before its
       * bytes are read, and the listing is refreshed once the last file has
       * landed.
       */
      const upload = useCallback(async (fileList) => {
        const files = Array.from(fileList ?? []);
        if (files.length === 0) return;
        setUploading(true);
        setUploadNote('');
        setUploadFailed(false);
        try {
          for (const file of files) {
            if (maxBytes !== null && file.size > maxBytes) {
              throw new Error(`${file.name}: ${t('label.uploadTooLarge')}`);
            }
            const data = await readAsBase64(file);
            await api.upload(listing?.path ?? directory, file.name, data);
          }
          setUploadNote(t('label.uploaded', { count: files.length }));
          refresh();
        } catch (cause) {
          setUploadFailed(true);
          setUploadNote(`${t('error.upload')} ${cause?.message ?? String(cause)}`);
        } finally {
          setUploading(false);
        }
      }, [api, directory, listing, maxBytes, refresh, t]);

      /**
       * Hand one file to the browser as a download.
       *
       * The bytes travel over the Harness's own authenticated file route, so
       * the browser saves them under the name the listing shows.
       */
      const download = useCallback((entry) => {
        const url = fileUrl(entry.path);
        if (url === undefined) return;
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = entry.name;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, []);

      /** Whether one file is larger than a single download may carry. */
      const tooLarge = useCallback((entry) => {
        if (maxBytes === null || typeof entry.size !== 'number') return false;
        return entry.size > maxBytes;
      }, [maxBytes]);

      const current = listing?.path ?? directory;
      const rows = listing?.entries ?? [];

      const toolbar = h('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
      },
        h('input', {
          type: 'text',
          value: input,
          'aria-label': t('label.path'),
          placeholder: t('label.path'),
          onChange: (event) => setInput(event.target.value),
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            open(input);
          },
          style: {
            flex: '1 1 260px',
            minWidth: 0,
            padding: '6px 10px',
            font: 'inherit',
            color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 8,
          },
        }),
        h('button', { type: 'button', onClick: () => open(input), style: buttonStyle }, t('action.go')),
        h('button', {
          type: 'button',
          onClick: () => open(listing?.home ?? ''),
          style: buttonStyle,
        }, t('action.home')),
        h('button', {
          type: 'button',
          onClick: () => listing?.parent && open(listing.parent),
          disabled: !listing?.parent,
          style: buttonStyle,
        }, t('action.up')),
        h('button', { type: 'button', onClick: refresh, style: buttonStyle }, t('action.refresh')),
        h('input', {
          type: 'file',
          multiple: true,
          ref: fileInput,
          onChange: (event) => {
            upload(event.target.files);
            event.target.value = '';
          },
          style: { display: 'none' },
        }),
        h('button', {
          type: 'button',
          onClick: () => fileInput.current?.click(),
          disabled: uploading,
          style: buttonStyle,
        }, uploading ? t('state.uploading') : t('action.upload')),
      );

      const quickPaths = useMemo(() => roots.map((path) => h('button', {
        key: path,
        type: 'button',
        onClick: () => open(path),
        title: path,
        style: {
          padding: '2px 8px',
          font: 'inherit',
          fontSize: 12,
          color: 'var(--dsw-alias-label-secondary)',
          background: 'transparent',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: 999,
          cursor: 'pointer',
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }, path)), [roots, open]);

      const header = h('header', {
        style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px 12px' },
      },
        h('h1', {
          style: { margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        }, t('page.title')),
        h('p', {
          style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' },
        }, t('page.intro')),
        toolbar,
        quickPaths.length > 0 ? h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: 6 },
        }, quickPaths) : null,
      );

      const listBody = h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' },
      },
        status === 'loading'
          ? h('div', { style: noteStyle }, t('state.loading'))
          : null,
        status === 'error'
          ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } },
            `${t('error.title')} ${error}`)
          : null,
        status === 'ready' && rows.length === 0
          ? h('div', { style: noteStyle }, t('state.empty'))
          : null,
        rows.map((entry) => h('button', {
          key: entry.path,
          type: 'button',
          onClick: () => (entry.kind === 'directory' ? open(entry.path) : select(entry)),
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 90px 160px',
            gap: 12,
            alignItems: 'center',
            padding: '6px 8px',
            font: 'inherit',
            fontSize: 13,
            textAlign: 'left',
            color: 'var(--dsw-alias-label-primary)',
            background: selected?.path === entry.path
              ? 'var(--dsw-alias-bg-layer-2)'
              : 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            cursor: 'pointer',
          },
        },
          h('span', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: entry.hidden ? 'var(--dsw-alias-label-secondary)' : undefined,
            },
          },
            h('span', {
              'aria-hidden': true,
              style: { flex: 'none', width: 14, color: entry.kind === 'directory'
                ? 'var(--dsw-alias-brand-primary)'
                : 'var(--dsw-alias-label-secondary)' },
            }, entry.kind === 'directory' ? '📁' : entry.kind === 'file' ? '📄' : '•'),
            h('span', {
              style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            }, entry.name)),
          h('span', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', textAlign: 'right' },
          }, entry.kind === 'file' ? formatBytes(entry.size) : ''),
          h('span', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
          }, formatTime(entry.modified)),
        )),
        listing?.truncated
          ? h('div', { style: noteStyle }, t('state.truncated'))
          : null,
      );

      const previewPane = h('div', {
        style: {
          flex: '1 1 320px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 16,
          borderLeft: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-layer-1)',
          overflow: 'auto',
        },
      },
        h('h2', {
          style: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
        }, t('label.preview')),
        selected === null
          ? h('div', { style: noteStyle }, t('label.noPreview'))
          : h('div', {
            style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', wordBreak: 'break-all' },
          }, selected.path),
        selected !== null && selected.kind === 'file'
          ? h('div', {
            style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
          },
            h('button', {
              type: 'button',
              onClick: () => download(selected),
              disabled: tooLarge(selected),
              style: buttonStyle,
            }, t('action.download')),
            tooLarge(selected)
              ? h('span', { style: { ...noteStyle, padding: 0 } }, `${t('label.tooLarge')} (${formatBytes(maxBytes)})`)
              : null)
          : null,
        previewStatus === 'loading'
          ? h('div', { style: noteStyle }, t('state.loading'))
          : null,
        previewStatus === 'error'
          ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } }, error)
          : null,
        previewStatus === 'image'
          ? h('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-start',
            },
          },
            h('img', {
              src: fileUrl(selected?.path ?? '') ?? '',
              alt: selected?.name ?? '',
              onError: () => setImageFailed(true),
              style: {
                maxWidth: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-layer-2)',
              },
            }),
            imageFailed
              ? h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } }, t('label.imageFailed'))
              : null)
          : null,
        preview?.binary
          ? h('div', { style: noteStyle }, t('label.binary'))
          : null,
        preview?.truncated
          ? h('div', { style: noteStyle }, t('label.truncated'))
          : null,
        preview && !preview.binary
          ? h('pre', {
            style: {
              margin: 0,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--dsw-alias-label-primary)',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l1)',
              borderRadius: 8,
            },
          }, preview.text)
          : null,
      );

      const createRow = h('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
      },
        h('input', {
          type: 'text',
          value: folderName,
          'aria-label': t('label.folderName'),
          placeholder: t('label.folderName'),
          onChange: (event) => setFolderName(event.target.value),
          style: {
            flex: '1 1 200px',
            minWidth: 0,
            padding: '6px 10px',
            font: 'inherit',
            fontSize: 13,
            color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: 8,
          },
        }),
        h('button', {
          type: 'button',
          onClick: createFolder,
          disabled: creating || folderName.trim() === '',
          style: buttonStyle,
        }, t('action.create')),
        h('button', {
          type: 'button',
          onClick: () => {
            setFolderName('');
            setCreateError('');
          },
          style: buttonStyle,
        }, t('action.cancel')),
        createError
          ? h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, createError)
          : null,
      );

      return h('section', {
        'aria-label': t('page.title'),
        'data-testid': 'host-file-explorer-page',
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          color: 'var(--dsw-alias-label-primary)',
          background: 'var(--dsw-alias-bg-base)',
        },
      },
        header,
        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            padding: '0 20px 12px',
          },
        }, createRow,
        h('span', {
          style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
        }, t('label.uploadHint')),
        uploadNote
          ? h('span', {
            style: {
              fontSize: 12,
              color: uploadFailed ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
            },
          }, uploadNote)
          : null),
        h('div', {
          style: {
            display: 'flex',
            flex: '1 1 auto',
            flexWrap: 'wrap',
            minHeight: 0,
            borderTop: '1px solid var(--dsw-alias-border-l1)',
          },
        },
          h('div', {
            style: { flex: '1 1 380px', minWidth: 0, padding: 12, overflow: 'auto' },
          }, listBody),
          previewPane,
        ),
        h('footer', {
          style: {
            padding: '8px 20px',
            fontSize: 12,
            color: 'var(--dsw-alias-label-secondary)',
            borderTop: '1px solid var(--dsw-alias-border-l1)',
            wordBreak: 'break-all',
          },
        }, current),
      );
    }

    /** The shared look of the page's plain buttons. */
    const buttonStyle = {
      padding: '6px 12px',
      font: 'inherit',
      fontSize: 13,
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-layer-2)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 8,
      cursor: 'pointer',
    };

    /** The shared look of the page's inline notes. */
    const noteStyle = {
      padding: '8px 4px',
      fontSize: 13,
      color: 'var(--dsw-alias-label-secondary)',
    };

    /** The Client services this half contributes through. */
    const inject = ['slots', 'locale', 'remote'];

    /**
     * Register the sidebar entry, the panel it opens, and the Remote namespace
     * the page reads the host through.
     *
     * @param ctx - the browser services used by these contributions.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'host-file-explorer: dictionaries');

      /**
       * Offer the panel's own languages to the Harness's language list.
       *
       * A language another plugin already offered is left alone: the
       * dictionary still applies to the panel, and the catalog keeps one entry
       * per language. The disposer removes only the languages this panel
       * added.
       */
      ctx.effect(() => {
        const release = [];
        for (const language of LANGUAGES) {
          try {
            release.push(ctx.locale.addLanguage(language));
          } catch {
            // the language is already in the catalog
          }
        }
        return () => {
          for (const dispose of release) dispose();
        };
      }, 'host-file-explorer: languages');

      const t = ctx.locale.bind(NS);

      let release = null;
      let disposed = false;
      const ready = ctx.remote.$mount(REMOTE).then((dispose) => {
        if (disposed) dispose();
        else release = dispose;
      });

      const call = async (method, args) => {
        await ready;
        if (disposed) throw new Error('the host file service is not available');
        const namespace = ctx.get(NAMESPACE_KEY);
        if (namespace === undefined) throw new Error('the host file service is not available');
        const result = await namespace[method](...args);
        if (result?.ok !== true) throw new Error(result?.error?.message ?? 'the host file service failed');
        return result.value;
      };

      const api = {
        roots: () => call('roots', []),
        list: (path) => call('list', [path]),
        stat: (path) => call('stat', [path]),
        read: (path) => call('read', [path]),
        mkdir: (path, name) => call('mkdir', [path, name]),
        upload: (path, name, data) => call('upload', [path, name, data]),
        limits: () => call('limits', []),
      };

      ctx.effect(() => () => {
        disposed = true;
        release?.();
        release = null;
      }, 'host-file-explorer: remote namespace');

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => t('panel'),
      }, FileExplorerIcon));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({ api }),
      }, FileExplorerPage));
    }

    return { inject, apply };
  },
});
