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

значение может быть true|false|"(http|https)путь до модуля"|"global:global_name"
 - url - может быть относительным или абсолютным. потдерживается два протокола http и https
 - global:global_name - префикс "global:" позволяет создавть глобальные обьекты
 - true - в модуль будет передан пустой обьект. var ключ={};
 - false - в модуль будет передано значение false. var ключ=false;
 

**свойство "styles"** - массив url адреса css файлов модуля. 

**свойство "scripts"** - массив url адреса js файлов модуля. 

каждый указанный файл будет завернут в свою облость видимости. В которую будут переданны 
переменные модулей указанных в разделе "modules"
```js
__MODULE(2, function(global,module,core,cram,xhr_send,elems,tmpl){'use strict';
	... код js файла ...
return [global,module,core,cram,xhr_send,elems,tmpl]});
```
в каждый js-файл будет обьявлена переменная **"module"**, (var module = {}). 

в любом js-файлt можно переопределить значение переменной **"module"** на свой обьект.
пример: ***js module = fucntion() {....};***


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





Описание возможностей web-сервиса "scmod"
--------------------------------------
для демонстрации сервис развернут по адресу http://scmod.vflash.ru/

###режим разработки:###


**метод /sandbox** - генерирует js файл для разработки

пример - http://scmod.vflash.ru/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера

пример применения
```html
<html>
	<head>
		<script src="http://scmod.vflash.ru/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json"></script>
	</head>
	<body> ... </body>
</html>

```

**метод /langs** - генерирует список локализации

пример - http://scmod.vflash.ru/langs?for=en,de&src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- for - указанные через через запятую языки для которых нужно искать перевод



###режим сборки:###


**метод /scripts** - обьединяет все js-файлы в один

пример - http://scmod.vflash.ru/scripts?lang=en&src=http://zzreader.com/js/zzreader/feedreader.json
	
	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- lang - все текстовые значения в js файлах обрамленные в "двойные кавычки" будут заменены на соответствуюшие указанные с свойстве модуля "langs"

**метод /styles** - обьединяет все css-файлы в один

пример - http://scmod.vflash.ru/styles?src=http://zzreader.com/js/zzreader/feedreader.json

	- src - абсолютный путь до корневого модуля. 
	- auth=base - если требуется http-authentication. логин и пароль передается только указанные в настройках сервера
	- min=false - чтобы отключить минификатор css 



Установка scmod сервера: 
--------------------------------------
проше всего установить через npm
```bash
[sudo] npm -g scmod
```
после нужно скопировать файл настройки сервиса scmod
```bash
[sudo] cp /usr/local/lib/node_modules/scmod/config.js  /usr/local/etc/scmod/config.js
```
правим астройки под себя


для Ubuntu подготовлен файл upstart
```bash
[sudo] ln -s /etc/init/scmod.conf /usr/local/lib/node_modules/
[sudo] start scmod
```

для других ОС можно воспользоватья forever
```bash
[sudo] npm install forever -g
[sudo] forever start /usr/local/lib/node_modules/scmod/modules.js
```

Настройка nginx
--------------------------------------














