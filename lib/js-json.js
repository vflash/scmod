var module;
if (typeof exports === 'object' && this == exports) {
	module = module.exports;
};


module.parser = function(s) {
	try {
		return JSON.parse(toJSON(s));

	} catch(e) {
		throw e;
	};
};

module.conv = toJSON;



// \/\*([^*]|\*(?=[^\/]))*\*\/ комментарий
// \/\/[^\n]* комментарий
// \"(\\\\|\\\"|[^\"\n])*\" текст в двойной кавычке
// \'(\\\\|\\\'|[^\'\n])*\' тектс в одерной кавычке
// \/(\\\\|\\\/|[^\/\n])+\/  регулярка
// -?\d[\d\.e-]*  число 

var regx = /,\s*[\]\}]|[\[\{]\s*,|\'(\\\\|\\\'|[^\'\n])*\'|\"(\\\\|\\\"|[^\"\n])*\"|-?\d[\d\.e-]*|[a-z_]\w+/g;

function toJSON(s) {
	return String(s).replace(/\/\*([^*]|\*(?=[^\/]))*\*\/|\/\/[^\n]*/g, '').replace(regx, re_toJSON);
};

function re_toJSON(s) {
	switch(s.charCodeAt(0)) {
		case 34: /* ["] */ return s;
		case 47: /* [/] */ return '';

		case 39: /* ['] */ 
			return '"' + s.substr(1, s.length-2).replace(/\\(.)|(")/g, '\\$1$2') + '"';
		case 44: /* [,] */
			//return s.substr(1);
			return s.charCodeAt(s.length-1) === 93 ? ']' : '}';
		case 91:  /* "[" */
			//return s.substr(0, s.length-1);
			return '[';
		case 123: /* "{" */
			//return s.substr(0, s.length-1);
			return '{';
		case 45:case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:
			return s;
		default:
			return '"' + s + '"';
	};
};





