<h1 align="center">♞ Chess Reviewer</h1>
<p align="center">Review your chess games with Stockfish, right in your browser.</p>

<p align="center">
  <a href="https://cesarpinardi.github.io/chess-reviewer/"><img src="https://img.shields.io/badge/Open%20Chess%20Reviewer-35582B?style=for-the-badge" alt="Open Chess Reviewer"></a>
  <a href="https://www.paypal.com/donate/?business=JT894TQVB822C&amp;no_recurring=0&amp;currency_code=USD"><img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-765218?style=for-the-badge&amp;logo=paypal&amp;logoColor=white" alt="Buy me a coffee on PayPal"></a>
</p>

## What you can do

- **Find turning points.** Follow the evaluation graph, jump to the next mistake, and see the reply Stockfish recommends.
- **Compare moves.** See the suggested alternative on the board, then use **Try moves** to play your own variation.
- **Review both sides.** The game summary counts best moves, inaccuracies, mistakes, and the other move classifications for White and Black.

## Review your first game

1. In Chess.com, open **Share → PGN** after the game. Copy the PGN or download the file.
2. In Chess Reviewer, choose **Import PGN**, paste the text or select the file, then click **Load game**.
3. Click **Analyze game**. Use the move list, graph, or arrow keys to navigate while Stockfish works.
4. Click **Next mistake** to jump to a turning point. Use **Show best move** to compare, or **Try moves** to play a line yourself. **Back to game** restores the original position.

You can also click **Analyze game** on the built-in sample. A PGN contains the full move history. A standalone FEN describes one position.

## Run locally

With Node.js installed, run this command from the repository root:

```sh
node serve.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173/). The app and engine are bundled in `dist/` for offline use through the local server.

## How analysis works

Stockfish 17.1 Lite runs in a dedicated browser worker, and your PGN stays in your browser. The search uses up to depth 13 and 10,000 nodes per position. The worker stops when analysis finishes or is canceled. The board uses stored results when you navigate or show an alternative.

Move classifications estimate the loss in evaluation for the side that moved. The project uses its own thresholds, so the labels can differ from Chess.com's. Explanations show the suggested continuation and highlight captures or checkmate when present.

## Deployment and credits

The [GitHub Pages workflow](.github/workflows/pages.yml) publishes `dist/` on pushes to `main`. For a fork, select **GitHub Actions** under **Settings → Pages** before running the workflow.

See [third-party sources and licenses](dist/vendor/sources.txt) for Stockfish, chess.js, and the chess pieces.
