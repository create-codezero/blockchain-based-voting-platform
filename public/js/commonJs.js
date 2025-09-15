function userMenu() {
    $(".userMenu").toggleClass("none");
}

document.querySelectorAll(".clickToCopyMe").forEach(function (element) {
    element.addEventListener("click", function () {
      var textToCopy = this.textContent || this.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert("Copied: " + textToCopy);
      }).catch(err => {
        console.error("Failed to copy text: ", err);
      });
    });
  });