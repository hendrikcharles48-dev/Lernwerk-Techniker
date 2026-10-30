/*
 * lernwerk-speicher.js
 * Satzwerk und Lernwerk liegen unter derselben Adresse und teilen sich den Browser-Speicher.
 * Deshalb tragen alle Lernwerk-Namen das Präfix "lernwerk:". Alte Werte der Trainer werden hier
 * einmalig übernommen. Die alten Einträge bleiben stehen, weil sie auch Satzwerk gehören können
 * (Satzwerk nutzt zum Beispiel ebenfalls "tol.").
 */
(function () {
  'use strict';
  var FLAG = 'lernwerk:speicherUmzug';
  var GENAU = ['sw_best', 'wissen:ok', 'terme-trainer-v1', 'statik-wandschwenkkran-done', 'calc:ans', 'calc:hist'];
  var ANFANG = ['trainer:', 'tol.', 'lw-ft:', 'et:', 'st:', 'statiktrainer:', 'tol:', 'toltrainer:'];
  try {
    var ls = window.localStorage;
    if (ls.getItem(FLAG)) return;
    var keys = [];
    for (var i = 0; i < ls.length; i++) keys.push(ls.key(i));
    keys.forEach(function (k) {
      if (!k || k.indexOf('lernwerk:') === 0) return;
      var passt = GENAU.indexOf(k) >= 0 || ANFANG.some(function (a) { return k.indexOf(a) === 0; });
      if (passt && ls.getItem('lernwerk:' + k) == null) ls.setItem('lernwerk:' + k, ls.getItem(k));
    });
    ls.setItem(FLAG, '1');
  } catch (e) { /* ohne Speicher weiter */ }
})();
