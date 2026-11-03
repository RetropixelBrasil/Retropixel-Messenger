const footer = document.getElementById("rpmFooter");

if (footer) {
  const currentYear = new Date().getFullYear();

  footer.textContent =
    `© Retropixel™, 2025-${currentYear}. Todos os direitos reservados.`;
}