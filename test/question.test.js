const { test } = require('node:test');
const assert = require('node:assert/strict');

const QuestionLogic = require('../src/QuestionLogic.js');
const MockData = require('../src/MockData.js');

test('selectQuestions: hanya jenis ybs + active, terurut order', () => {
  const qs = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
  assert.equal(qs.every((q) => q.jenis === 'keluarga' && q.active === true), true);
  const orders = qs.map((q) => q.order);
  assert.deepEqual(orders, orders.slice().sort((a, b) => a - b));
  // soft-deleted tidak ikut
  assert.equal(qs.some((q) => q.question_id === 'catatan_lama'), false);
});

test('selectQuestions: includeInactive=true menyertakan soft-deleted', () => {
  const qs = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', true);
  assert.equal(qs.some((q) => q.question_id === 'catatan_lama'), true);
});

test('selectQuestions: usaha & keluarga tidak bocor silang', () => {
  const usaha = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'usaha', false);
  assert.equal(usaha.some((q) => q.question_id === 'b1r13_1'), false);
  assert.equal(usaha.some((q) => q.question_id === 'r27c'), true);
});

test('selectQuestions: roster keluarga ikut dengan roster_group terisi', () => {
  const qs = QuestionLogic.selectQuestions(MockData.QUESTIONS, 'keluarga', false);
  const roster = qs.filter((q) => q.roster_group === 'anggota_keluarga');
  assert.deepEqual(roster.map((q) => q.question_id), ['b1r6_n', 'b1r8_n', 'b1r11_n', 'b3r20a_n']);
});

test('selectQuestions: urutan tidak memutasi array sumber', () => {
  const before = MockData.QUESTIONS.map((q) => q.question_id);
  QuestionLogic.selectQuestions(MockData.QUESTIONS, 'usaha', false);
  assert.deepEqual(MockData.QUESTIONS.map((q) => q.question_id), before);
});
