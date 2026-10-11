# Logo GoIndica

## Arquivos finais

- `logo.svg` e `public/goindica-logo.svg`: master vetorial, com letras convertidas em contornos e apenas duas cores sólidas.
- `logo.png` e `public/goindica-logo.png`: exportação transparente de 4.096 × 990 px do master SVG.
- `logo-original.png`: referência original preservada.
- `src/app/icon.svg`: o mesmo símbolo dos balões, adaptado ao ícone de 64 px.

O balão azul e “Go” usam `#0252DC`. O balão verde e “Indica” usam `#347D25`, também compartilhado pelos botões principais. Os arquivos SVG não dependem de fontes, filtros, imagens externas ou de fundo branco. As letras são contornos de Inter Display ExtraBold; veja `public/ATTRIBUTION.md`.

## Processo

Foi usado o gerador de imagens integrado para explorar uma reconstrução da referência. Para garantir curvas nítidas, cores exatas e escala ilimitada, o arquivo final foi reconstruído geometricamente em SVG, com tipografia em contornos. O PNG final foi exportado desse SVG; a imagem exploratória não é usada no aplicativo.

Prompt do estudo: “Rebuild the existing GoIndica logo, preserving the two interlocking circular speech bubbles and the horizontal bold geometric wordmark. Use only flat blue #0252DC for the left bubble and Go, and flat green #347D25 for the right bubble and Indica. Use the same exact colors in symbol and typography. Remove gradients, shadows and texture. Keep the name exactly GoIndica, clean crisp edges and a transparent background.”
