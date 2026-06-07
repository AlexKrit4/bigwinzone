# Книги Das xBoot (`BOOKS_XBOOT_V1`)

Файл данных: **`games/xboot/books-seeds.txt`**.

## Характеристики (цели генератора)

| Параметр | Значение |
|----------|----------|
| RTP | 96.03% |
| Hit frequency | 22.17% |
| Free Spins | ~1 из 211 спинов (0.474%) |
| Max payout | 55 200× ставки |
| Max win book | id `88888`, seed в шапке `JACKPOT_SEED` |

## Генерация

```bash
npm run xboot-books
```

Скрипт: `generate-xboot-books.js`  
Симулятор: `xboot-slot-sim.js` (цепочка как в `games/xboot/slot.js`)  
Парсер: `xboot-books-parse.js`

## Формат строки (TAB)

```
seed  total_win@1  has_bonus  reels  weights  nudge_mult  [N  (reels  weights  nudge)×N]
```

- **reels / weights**: 6 групп через `|`, в группе — значения через `,` (ряды 2-3-4-4-3-2).
- **nudge_mult**: 6 множителей xNudge по барабанам (`1` по умолчанию).
- **has_bonus = 1** и ≥3 scatter на базе → хвост из 7 фри-спинов (bonus3: 3-й барабан 8 рядов).

## Индексы символов

`low1`…`target` = 0–14; `wild4` = 15; `xways4` = 16; `xwild4` = 17.

Префикс seed: `xb_`.
