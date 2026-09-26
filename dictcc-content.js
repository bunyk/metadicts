// Automatically check the "ifcbnw" checkbox on deuk.dict.cc

console.log('running');
const checkbox = document.getElementById('ifcbnw');
const inpf = document.getElementById('inpfid');
console.log(checkbox, inpf);
if (checkbox && inpf) {
  checkbox.checked = true;
  inpf.target='dccsug';
}
