SCMOD - javascript modules
==================================================
web сервис для написания javascript кода в модульном стиле


Предисловие
--------------------------------------

В свое время пробовал асинхронно загружать по требованию но переизбыток асинхронности усложняет
код. Позже стал просто объединять файлы в один, а для описания связей использовал отдельные 
файлы. Программируя под nodejs оценил удобство когда каждый файл имеет свою область видимости.

Появилась идея сделать менеджер js-файлов в виде веб сервиса. Сервису указываем корневой 
модуль, а он формирует список файлов и отдает js код для подключения этих файлов через прокси 
который оборачивает исходник в функцию(своя область видимости).



Описание json структуры модуля.
--------------------------------------

модуль описывается файлом в формате json

пример модуля - http://zzreader.com/js/zzreader/cmps/cmps.moon_frame.json
```js
{
	"modules": {
		"core": "../core/core.json",
		"cram": "./lib.cram.json",
		"xhr_send": "../core/xhr_send.json",
		"_zmenu": "./cmps.zmenu.json",


		"elems": "global:elems",
		"tmpl": "global:tmpl"
		
	},
	
	"styles": [
		"./cmps.moon_frame.css"
	],

	"scripts": [
		"./cmps.moon_frame.tmpl.js",
		"./cmps.moon_frame.js"
	]
}
```




**свойство "modules"** - ассоциативный массив требуемых модулей

список записей "ключ: занчение"

ключ должен удовлетворять условию наименования переменных в javascript.
если имя ключа начинается с символа "_" , то такой модуль подключается но не передается 
в модуль как переменная.

значение может быть - ***url | "global:global_name" | true | false | object***
 - url - может быть относительным или абсолютным. потдерживается два протокола http и https
 - global:global_name - префикс "global:" позволяет создавть глобальные обьекты
 - true - в модуль будет передано значение false. var ключ=true;
 - false - в модуль будет передано значение false. var ключ=false;
 - object - в модуль будет передан указанный обьект.  var ключ={... };
 

**свойство "styles"** - массив url адресов css файлов модуля. 

**свойство "scripts"** - массив url адресов js файлов модуля. 

каждый js-файл будет завернут в свою облость видимости. В которую будут переданны 
переменные модулей указанных в разделе "modules"
```js
__MODULE(2, function(global,module,core,cram,xhr_send,elems,tmpl){'use strict';
	... код js файла ...
return [global,module,core,cram,xhr_send,elems,tmpl]});
```
в каждом js-файле будет обьявлена переменная **"module"**, (var module = {}). 
И любой js-файл может изменить значение этой переменной.




**свойство "alias"** - изменяет имя переменной "module"
```js
{
	"alias": "feed",
	...
}
```

```js
__MODULE(2, function(global,feed,...
	... код js файла ...
... });
```


**свойство "nowrap"** - для js файлов можно отключить обварачивание в облость видемости.
js-файлы будут подключенны без изменений как они есть.
```js
{
	"nowrap": true,
	"scripts": [
		, "... "
	],
	...
}
```

**свойство "langs"** - для автоматического перевода текстовых значений в js-файле во время компиляции

заменяются только значения в двойных кавычках
```js
{
	... ,

	"langs": {
		"текст который требует перевода": {
			"ru": "текст перевода",
			"en": "the translation",
			"vn": "bản dịch",
			....
		},
		......
	}
}
```


**свойство "replace"** - функционал для подмены адреса

по таблице можно поменять одни адреса другими. К примеру глобальный на локальные
```js
{
	... ,

	"replace": {
		"http://aaaaa.aa/xxxx.json": "./deps/aaaaa/xxxx.json",
		......
	}
}
```



Описание возможностей web-сервиса "scmod"
--------------------------------------
для демонстрации сервис развернут по адресу http://scmod.vflash.ru/

###режим разработки:###


**метод /sandbox** - генерирует js файл для разработки

пример - http://scmod.vflash.ru/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- rep - разрешает подмену адрисов. значение true|false|url

пример применения
```html
<html>
	<head>
		<script src="http://scmod.vflash.ru/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json"></script>
		<noscript>
			<link rel="stylesheet" href="http://scmod.vflash.ru/sandbox_styles?src=http://zzreader.com/js/zzreader/feedreader.json" type="text/css" />
		</noscript>

	</head>
	<body> ... </body>
</html>

```

**метод /langs** - генерирует список локализации

пример - http://scmod.vflash.ru/langs?for=en,de&src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- for - указанные через через запятую языки для которых нужно искать перевод
	- rep - разрешает подмену адрисов. значение true|false|url



###режим сборки:###


**метод /scripts** - обьединяет все js-файлы в один

пример - http://scmod.vflash.ru/scripts?lang=en&src=http://zzreader.com/js/zzreader/feedreader.json
	
	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- lang - все текстовые значения в js файлах обрамленные в "двойные кавычки" будут заменены на соответствуюшие указанные с свойстве модуля "langs"
	- rep - разрешает подмену адрисов. значение true|false|url

**метод /styles** - обьединяет все css-файлы в один

пример - http://scmod.vflash.ru/styles?src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- min=false - чтобы отключить минификатор css 
	- rep - разрешает подмену адрисов. значение true|false|url



Установка scmod сервера: 
--------------------------------------
проше всего установить через npm
```bash
[sudo] npm -g install scmod
```
после нужно скопировать файл настройки сервиса scmod
```bash
[sudo] cp /usr/local/lib/node_modules/scmod/config.js  /usr/local/etc/scmod/config.js
```
правим настройки под себя


для Ubuntu подготовлен файл upstart
```bash
[sudo] ln -s /etc/init/scmod.conf /usr/local/lib/node_modules/scmod.conf
[sudo] start scmod
```

для других ОС можно воспользоватья forever
```bash
[sudo] npm install forever -g
[sudo] forever start /usr/local/lib/node_modules/scmod/modules.js
```

Настройка nginx
--------------------------------------

```
server {
    listen   80;
    server_name  scmod.vflash.ru;
    access_log  /var/log/nginx/scmod.access.log;

    location / {
        proxy_pass http://127.0.0.1:1777/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP  $remote_addr;
    }
}
```

если нет возможности выделить отдельный домен то нужно будет указать дополнительные заголовки
```
# vflash.ru/scmod/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json

location /scmod/ {
    proxy_pass http://127.0.0.1:1777/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP  $remote_addr;

    proxy_set_header X-SCMOD-HOST  $host/scmod;
    proxy_set_header X-SCMOD-SCHEME $scheme;
}
```



Планы на будующее 
--------------------------------------

 - Возможность компиляции из консоли
 - Функционал для подмены url 
 - Дать возможность указывать зависимости непосредственно в js-файле. Используя конструкции вида:

```js
import '../core/core.json' as core;

var xx = ...;
...

```







