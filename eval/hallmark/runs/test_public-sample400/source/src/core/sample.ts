export const sampleEntries = [
  {kind:'Verified',raw:'Vaswani, A., et al. (2017). Attention Is All You Need. arXiv:1706.03762.'},
  {kind:'Verified',raw:'He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep Residual Learning for Image Recognition. Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition. https://doi.org/10.1109/CVPR.2016.90'},
  {kind:'Details differ',raw:'LeCun, Y., Bengio, Y., & Hinton, G. (2022). Deep learning. Nature, 521, 436–444. https://doi.org/10.1038/nature14539'},
  {kind:'Details differ',raw:'Goodfellow, I., & Szegedy, C. (2015). Deep learning. Nature, 521, 436–444.'},
  {kind:'Identifier conflict',raw:'He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep Residual Learning for Image Recognition. https://doi.org/10.1038/nature14539'},
  {kind:'No record found',raw:'Bennett, R., & Alvarez, M. (2023). Citation-grounded uncertainty calibration for multilingual academic writing assistants. Journal of Artificial Intelligence Research, 78, 241–259.'},
  {kind:'Retracted',raw:'Wakefield, A. J., et al. (1998). Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351, 637–641. https://doi.org/10.1016/S0140-6736(97)11096-0'},
  {kind:'Could not check',raw:'World Health Organization. (2024). Climate change. https://www.who.int/news-room/fact-sheets/detail/climate-change'}
] as const;
export const SAMPLE=sampleEntries.map((s,i)=>`[${i+1}] ${s.raw}`).join('\n\n');
