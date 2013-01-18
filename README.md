�����������

� ���� ����� �������� ���������� ��������� �� ���������� �� ����������� ������������� ���������
���. ����� ���� ������ ���������� ����� � ����, � ��� �������� ������ ����������� ��������� 
�����. ������������ ��� nodejs ������ �������� ����� ������ ���� ����� ���� ������� ���������.

��������� ���� ������� �������� js-������ � ���� ��� �������. ������� ��������� �������� 
������, � �� ��������� ������ ������ � ������ js ��� ��� ����������� ���� ������ ����� ������ 
������� ����������� �������� � �������(���� ������� ���������).



�������� json ��������� ������.

// ������� ������ http://zzreader.com/js/zzreader/cmps/cmps.moon_frame.json
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



������ ����������� ������ � ������� json

�������� "modules" - ������������� ������ ��������� �������
������������ ��� "����: ��������"
���� ������ ������������� ������� ������������ ���������� � javascript.
���� ��� ����� ���������� � ������� "_" , �� ����� ������ ������������ �� �� ���������� 
� ������ ��� ����������.

�������� ����� ���� true|false|"(http|https)���� �� ������"|"global:global_name"
 - url - ����� ���� ������������� ��� ����������. �������������� ��� ��������� http � https
 - global:global_name - ������� "global:" ��������� �������� ���������� �������
 - true - � ������ ����� ������� ������ ������. var ����={};
 - false - � ������ ����� �������� �������� false. var ����=false;
 

�������� "styles" - ������ url ������ css ������ ������. 


�������� "scripts" - ������ url ������ js ������ ������. 
������ ��������� ���� ����� �������� � ���� ������� ���������. � ������� ����� ��������� 
���������� ������� ��������� � ������� "modules"

__MODULE(2, function(global,module,core,cram,xhr_send,elems,tmpl){'use strict';
	... ��� js ����� ...
return [global,module,core,cram,xhr_send,elems,tmpl]});

� ������ ���� "scripts" ����� ����� ������ "module" . 
����� �� ���� ������ ����� ��� ��������������, ������� �� ���� ������.
������: module = fucntion() {....}; 


�������� "alias" - �������� ��� ���������� "module"
{
	"alias": "feed",
	...
}

__MODULE(2, function(global,feed,...
	... ��� js ����� ...
... });


�������� "nowrap" - ��� js ������ ����� ��������� ������������� � ������� ���������.
js-����� ����� ����������� ��� ��������� ��� ��� ����.
{
	"nowrap": true,
	"scripts": [
		, "... "
	],
	...
}





�������� ������������ web-������� "scmod"
��� ������������ ������ ��������� �� ������ http://scmod.vflash.ru/


����� ����������:

����� /sandbox - ���������� js ���� ��� ����������
������ - http://scmod.vflash.ru/sandbox?src=http://zzreader.com/js/zzreader/feedreader.json

��������:
	- src - ���������� ���� �� ��������� ������. 
	- auth=base - ���� ��������� http-authentication. ����� � ������ ���������� ������ ��������� � ���������� �������

����� /langs - ���������� ������ �����������
������ - http://scmod.vflash.ru/langs?for=en,de&src=http://zzreader.com/js/zzreader/feedreader.json
	- src - ���������� ���� �� ��������� ������. 
	- auth=base - ���� ��������� http-authentication. ����� � ������ ���������� ������ ��������� � ���������� �������
	- for - ��������� ����� ����� ������� ����� ��� ������� ����� ������ �������



����� ������:

����� /scripts - ���������� ��� js-����� � ����
������ - http://scmod.vflash.ru/scripts?src=http://zzreader.com/js/zzreader/feedreader.json
	- src - ���������� ���� �� ��������� ������. 
	- auth=base - ���� ��������� http-authentication. ����� � ������ ���������� ������ ��������� � ���������� �������
	- lang - ��� ��������� �������� � js ������ ����������� � "������� �������" ����� �������� �� ��������������� ��������� � �������� ������ "langs"

����� /styles - ���������� ��� css-����� � ����
	- src - ���������� ���� �� ��������� ������. 
	- auth=base - ���� ��������� http-authentication. ����� � ������ ���������� ������ ��������� � ���������� �������



���������: 

����� ����� ���������� ����� npm
[sudo] npm -g scmod
����� ����� ����������� ���� ��������� ������� scmod
[sudo] cp /usr/local/lib/node_modules/scmod/config.js  /usr/local/etc/scmod/config.js
������ �������� ��� ����


��� Ubuntu ����������� ���� upstart
[sudo] ln -s /etc/init/scmod.conf /usr/local/lib/node_modules/
[sudo] start scmod

��� ������ �� ����� �������������� forever
[sudo] npm install forever -g
[sudo] forever start /usr/local/lib/node_modules/scmod/modules.js


��������� nginx














