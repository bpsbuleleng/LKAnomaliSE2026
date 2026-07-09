const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadHtmlScript = require('./helpers/loadHtmlScript.js');
const DraftLogic = loadHtmlScript('src/DraftLogic.html');

const T1 = '2026-07-07T01:00:00.000Z';
const T2 = '2026-07-07T02:00:00.000Z';

test('draft baru: bersih (rev 0), tidak dirty', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  assert.equal(DraftLogic.isDirty(d), false);
  assert.deepEqual(d.answers, { roster: {} });
});

test('setAnswer menaikkan rev → dirty; markSynced dengan rev terkirim → bersih', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  DraftLogic.setAnswer(d, 'b4r5', 120, T2);
  assert.equal(d.rev, 1);
  assert.equal(DraftLogic.isDirty(d), true);
  DraftLogic.markSynced(d, 1, 'R-9', T2);
  assert.equal(DraftLogic.isDirty(d), false);
  assert.equal(d.record_id, 'R-9');
});

test('RACE: edit saat sync in-flight → respons telat TIDAK menandai bersih', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  DraftLogic.setAnswer(d, 'b4r5', 120, T1); // rev 1 → dikirim
  const sentRev = d.rev;
  DraftLogic.setAnswer(d, 'b4r5', 130, T2); // rev 2, user masih ngetik
  DraftLogic.markSynced(d, sentRev, 'R-9', T2); // respons rev 1 baru datang
  assert.equal(d.syncedRev, 1);
  assert.equal(DraftLogic.isDirty(d), true); // rev 2 belum terkirim
});

test('markSynced tidak menurunkan syncedRev (respons out-of-order)', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  DraftLogic.setAnswer(d, 'x', 1, T1);
  DraftLogic.setAnswer(d, 'x', 2, T1);
  DraftLogic.markSynced(d, 2, 'R-9', T2);
  DraftLogic.markSynced(d, 1, 'R-9', T2); // telat
  assert.equal(d.syncedRev, 2);
  assert.equal(DraftLogic.isDirty(d), false);
});

test('setWilayah: nilai sama tidak bikin dirty', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  DraftLogic.setWilayah(d, '', T2);
  assert.equal(DraftLogic.isDirty(d), false);
  DraftLogic.setWilayah(d, '5108010002000101', T2);
  assert.equal(DraftLogic.isDirty(d), true);
});

test('roster: add/set/remove baris', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  DraftLogic.addRosterRow(d, 'anggota_keluarga', T1);
  DraftLogic.addRosterRow(d, 'anggota_keluarga', T1);
  DraftLogic.setRosterField(d, 'anggota_keluarga', 0, 'b1r6_n', 'KETUT ADI', T1);
  DraftLogic.setRosterField(d, 'anggota_keluarga', 1, 'b1r6_n', 'NI LUH SARI', T1);
  assert.equal(d.answers.roster.anggota_keluarga.length, 2);
  DraftLogic.removeRosterRow(d, 'anggota_keluarga', 0, T2);
  assert.deepEqual(d.answers.roster.anggota_keluarga, [{ b1r6_n: 'NI LUH SARI' }]);
});

test('roster: jumlah_<group> di answers selalu mengikuti banyak baris', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  assert.equal('jumlah_anggota_keluarga' in d.answers, false); // belum pernah disentuh
  DraftLogic.addRosterRow(d, 'anggota_keluarga', T1);
  DraftLogic.addRosterRow(d, 'anggota_keluarga', T1);
  assert.equal(d.answers.jumlah_anggota_keluarga, 2);
  DraftLogic.removeRosterRow(d, 'anggota_keluarga', 1, T2);
  assert.equal(d.answers.jumlah_anggota_keluarga, 1);
  DraftLogic.addRosterRow(d, 'meteran_listrik', T2); // grup lain independen
  assert.equal(d.answers.jumlah_meteran_listrik, 1);
  assert.equal(d.answers.jumlah_anggota_keluarga, 1);
});

test('fromServerRecord: dianggap sinkron & roster dijamin ada', () => {
  const d = DraftLogic.fromServerRecord({
    record_id: 'R-1', pml_email: 'a@b.com', jenis: 'usaha', status: 'draft',
    wilayah: { idsubsls: '5108010002000101' }, answers: { r25: 2019 }, updated_at: T1
  });
  assert.equal(DraftLogic.isDirty(d), false);
  assert.equal(d.localId, 'R-1');
  assert.equal(d.idsubsls, '5108010002000101');
  assert.deepEqual(d.answers.roster, {});
});

test('mergeDashboard: server bersih + lokal dirty + lokal-belum-pernah-sync', () => {
  const server = [
    { record_id: 'R-1', jenis: 'usaha', status: 'draft', idsubsls: '', nmdesa: '', nmsls: '', kdsubsls: '', pml_email: 'kadek@x.com', nmpml: 'KADEK', updated_at: T1 },
    { record_id: 'R-2', jenis: 'keluarga', status: 'draft', idsubsls: '', nmdesa: '', nmsls: '', kdsubsls: '', updated_at: T1 }
  ];
  const dirtyLocal = DraftLogic.newDraft('L-9', 'a@b.com', 'keluarga', T1);
  dirtyLocal.record_id = 'R-2';
  DraftLogic.setAnswer(dirtyLocal, 'b4r5', 99, T2);
  const neverSynced = DraftLogic.newDraft('L-7', 'a@b.com', 'usaha', T2);
  DraftLogic.setAnswer(neverSynced, 'nama_usaha', 'Warung', T2);
  const emptyDraft = DraftLogic.newDraft('L-8', 'a@b.com', 'usaha', T1); // tak pernah diedit

  const items = DraftLogic.mergeDashboard(server, [dirtyLocal, neverSynced, emptyDraft]);
  assert.equal(items.length, 3); // draft kosong di-skip
  const r1 = items.find((i) => i.record_id === 'R-1');
  const r2 = items.find((i) => i.record_id === 'R-2');
  const l7 = items.find((i) => i.localId === 'L-7');
  assert.equal(r1.unsynced, false);
  assert.equal(r1.pml_email, 'kadek@x.com'); // diteruskan dari record server (dipakai badge organik)
  assert.equal(r1.nmpml, 'KADEK');
  assert.equal(r2.unsynced, true);
  assert.equal(r2.localId, 'L-9');
  assert.equal(l7.unsynced, true);
  assert.equal(l7.record_id, null);
  assert.equal(l7.pml_email, 'a@b.com'); // draft lokal murni: milik sesi yang sedang login
});

test('judulRecord (client) & mergeDashboard.judul: dirty pakai jawaban lokal, bersih pakai judul server', () => {
  assert.equal(DraftLogic.judulRecord('keluarga', { roster: { anggota_keluarga: [
    { b1r6_n: 'A' }, { b1r6_n: 'B' }, { b1r6_n: 'C' }
  ] } }), 'A / B');
  assert.equal(DraftLogic.judulRecord('usaha', { nama_usaha: 'WARUNG' }), 'WARUNG');

  const server = [{ record_id: 'R-1', jenis: 'keluarga', status: 'draft', judul: 'DARI SERVER',
    idsubsls: '', nmdesa: '', nmsls: '', kdsubsls: '', updated_at: T1 }];
  const clean = DraftLogic.mergeDashboard(server, []);
  assert.equal(clean[0].judul, 'DARI SERVER');

  const dirty = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  dirty.record_id = 'R-1';
  DraftLogic.addRosterRow(dirty, 'anggota_keluarga', T2);
  DraftLogic.setRosterField(dirty, 'anggota_keluarga', 0, 'b1r6_n', 'LOKAL BARU', T2);
  const merged = DraftLogic.mergeDashboard(server, [dirty]);
  assert.equal(merged[0].judul, 'LOKAL BARU'); // editan lokal belum terkirim menang
});

test('mergeDashboard: server tak terjangkau (list kosong) → draft lokal ber-record_id tetap tampil', () => {
  const d = DraftLogic.newDraft('L-1', 'a@b.com', 'keluarga', T1);
  d.record_id = 'R-1';
  DraftLogic.setAnswer(d, 'b4r5', 99, T2);
  const items = DraftLogic.mergeDashboard([], [d]);
  assert.equal(items.length, 1);
  assert.equal(items[0].unsynced, true);
});
