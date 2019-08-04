/**
 * Original work Copyright (c) 2016 Philippe FERDINAND
 * Modified work Copyright (c) 2016 Kam Low
 *
 * @license MIT
 **/
'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var log = require('winston');
var handlebars = require('handlebars');

module.exports = {

  inline: function(code) {
    if (Array.isArray(code)) {
      var refs, s = '', isInline = false;
      code.forEach(function (e) {
        refs = e.split(/(\[.*\]\(.*\)|\n|\s{2}\n)/g);
        refs.forEach(function (f) {
          if (f.charAt(0) == '[') {
            // link
            var link = f.match(/\[(.*)\]\((.*)\)/);
            if (link) {
              isInline ? (s += '`') && (isInline = false) : null;
              s += '[`' + link[1] + '`](' + link[2] + ')';
            }
          }
          else if (f == '\n' || f == '  \n') {
            // line break
            isInline ? (s += '`') && (isInline = false) : null;
            s += f;
          }
          else if (f) {
            !isInline ? (s += '`') && (isInline = true) : null;
            s += f;
          }
        });
      });
      return s + (isInline ? '`' : '');
    }
    else {
      return '`' + code + '`';
    }
  },

  getAnchor: function(name, options) {
    if (options.anchors) {
      return '{#' + name + '}';
    }
    else if (options.htmlAnchors) {
      return '<a id="' + name + '"></a>';
    }
    else {
      return '';
    }
  },

  findParent: function(compound, kinds) {
    while (compound) {
      if (kinds.includes(compound.kind))
        return compound;
      compound = compound.parent;
    }
  },

  // Replace ref links to point to correct output file if needed
  resolveRefs: function(content, compound, references, options) {
    if( content === undefined ){
      return '';
    }

    return content.replace(/\{#ref ([^ ]+) #\}/g, function(_, refid) {
      var ref = references[refid]
      var page = this.findParent(ref, ['page']);

      if (page) {
        if (page.refid == compound.refid)
          return '#' + refid;
        return options.linkprefix + this.compoundPath(page, options).replace('.md', options.linksuffix) + '#' + refid;
      }

      if (options.groups) {
        if (compound.groupid && compound.groupid == ref.groupid)
          return '#' + refid;
        return options.linkprefix + this.compoundPath(ref, options).replace('.md', options.linksuffix) + '#' + refid;
      } else if (options.classes) {
        var dest = this.findParent(ref, ['namespace', 'class', 'struct']);
        if (!dest || compound.refid == dest.refid)
          return '#' + refid;
        return options.linkprefix + this.compoundPath(dest, options).replace('.md', options.linksuffix) + '#' + refid;
      } else {
        if (compound.kind == 'page')
          return options.linkprefix + this.compoundPath(compound.parent, options).replace('.md', options.linksuffix) + '#' + refid;
        return '#' + refid;
      }
    }.bind(this));
  },

  compoundPath: function(compound, options) {
    if (compound.kind == 'page') {
      return path.dirname(options.output) + "/page-" + compound.name + '.md';
    } else if (options.groups) {
      return util.format(options.output, compound.groupname);
    } else if (options.classes) {
      var name = compound.name.replace(/\:/g, '-'); //namepace::api -> namespace--api
      name = name.replace('--', '-'); //namespace--api -> namespace-api
      return util.format(options.output, name);
    } else {
      return options.output;
    }
  },

  writeCompound: function(compound, contents, references, options) {
    this.writeFile(this.compoundPath(compound, options), contents.map(function(content) {
      return this.resolveRefs(content, compound, references, options);
    }.bind(this)));
  },

  // Write the output file
  writeFile: function (filepath, contents) {
    log.verbose('Writing', filepath);
    var stream = fs.createWriteStream(filepath);
    stream.once('open', function(fd) {
      contents.forEach(function (content) {
        if (content)
          stream.write(content);
      });
      stream.end();
    });
  }
};
