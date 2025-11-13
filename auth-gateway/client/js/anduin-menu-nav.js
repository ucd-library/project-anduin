let dagsterButton = `<div class="sc-aa87ce19-0 clCtDV MainNavigation_group__GKyku">
  <div class="MainNavigation_itemContainer__B0Vw0">
  <a class="MainNavigation_link__ZN8D1" href="/">
    <div class="sc-aa87ce19-0 hooEXL">
      <div>Anduin Home</div>
    </div>
  </a></div>
</div>
</div>`;

let supersetButton = `<li class="ant-menu-item" role="menuitem">
  <a href="/">
    <span class="anticon anticon-home">
      <svg viewBox="64 64 896 896" focusable="false" class="" data-icon="home" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M946.5 505L512 138.7 77.5 505l60.3 73.6L192 512v352c0 17.7 14.3 32 32 32h192V656c0-17.7 14.3-32 32-32h128c17.7 0 32 14.3 32 32v240h192c17.7 0 32-14.3 32-32V512l54.2 66.6z"></path></svg>
    </span>
    <span>Anduin Home</span>
  </a>
</li>`;

document.addEventListener("DOMContentLoaded", function() {
  if( window.location.pathname.startsWith('/dagster') ) {
    insertDagsterButton();
  } else if( window.location.pathname.startsWith('/superset') ) {
    insertSupersetButton();
  }
});

function insertSupersetButton() {
  let ele = document.querySelector('.ant-menu.ant-menu-root.main-nav');
  if( ele ) {
    ele.innerHTML += supersetButton;
    console.log('Inserted button');
  } else {
    console.log('Button container not found, retrying...');
    setTimeout(insertSupersetButton, 100);
  }
}

function insertDagsterButton() {
  let ele = document.querySelector('.MainNavigation_topGroups__C7EG9');
  if( ele ) {
    ele.innerHTML += dagsterButton;
    console.log('Inserted button');
  } else {
    console.log('Button container not found, retrying...');
    setTimeout(insertDagsterButton, 100);
  } 
}

console.log('Injected script');