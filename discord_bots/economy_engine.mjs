import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data/galaxy_database.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS station_inventory (
    station_id TEXT PRIMARY KEY,
    ware_id TEXT,
    stock INTEGER DEFAULT 100,
    max_capacity INTEGER DEFAULT 500,
    buy_price INTEGER,
    sell_price INTEGER
  );

  CREATE TABLE IF NOT EXISTS contract_board (
    contract_id TEXT PRIMARY KEY,
    title TEXT,
    issuer_station TEXT,
    contract_type TEXT,
    target_ware TEXT,
    required_qty INTEGER,
    reward_credits INTEGER,
    status TEXT DEFAULT 'open',
    created_at INTEGER
  );
`);

const stmtInsertStationStock = db.prepare('INSERT INTO station_inventory (station_id, ware_id, stock, max_capacity, buy_price, sell_price) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(station_id) DO UPDATE SET stock=excluded.stock, buy_price=excluded.buy_price, sell_price=excluded.sell_price');
const stmtGetStationStock = db.prepare('SELECT * FROM station_inventory WHERE station_id = ?');
const stmtInsertContract = db.prepare('INSERT INTO contract_board (contract_id, title, issuer_station, contract_type, target_ware, required_qty, reward_credits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(contract_id) DO NOTHING');
const stmtGetOpenContracts = db.prepare("SELECT * FROM contract_board WHERE status = 'open'");

export function runEconomicTick() {
  const stations = [
    { id: 'argon_prime_refinery', ware: 'ore', stock: 40, cap: 500, basePrice: 15 },
    { id: 'microchip_fab_01', ware: 'microchips', stock: 15, cap: 200, basePrice: 180 },
    { id: 'paranid_quantum_complex', ware: 'quantum_tubes', stock: 10, cap: 150, basePrice: 240 }
  ];

  const now = Date.now();
  const generatedContracts = [];

  for (const st of stations) {
    // Stock fluctuates based on simulated station consumption
    const newStock = Math.max(5, st.stock + Math.floor(Math.random() * 20) - 10);
    const scarcityRatio = 1 - (newStock / st.cap);
    const buyPrice = Math.round(st.basePrice * (1 + scarcityRatio * 0.8));
    const sellPrice = Math.round(buyPrice * 1.15);

    stmtInsertStationStock.run(st.id, st.ware, newStock, st.cap, buyPrice, sellPrice);

    // If stock drops below 25%, auto-generate a urgent Station Supply Deficit contract!
    if (newStock < 25) {
      const contractId = `cnt_${st.id}_${now}`;
      const title = `🚨 URGENT: Freight Supply Deficit at ${st.id.replace(/_/g, ' ').toUpperCase()}`;
      const reward = Math.round(buyPrice * 30 * 1.5);
      
      stmtInsertContract.run(contractId, title, st.id, 'freight_delivery', st.ware, 30, reward, 'open', now);
      generatedContracts.push({ contractId, title, reward, ware: st.ware });
    }
  }

  return { ok: true, generatedContracts };
}

export function getOpenContracts() {
  return stmtGetOpenContracts.all();
}
