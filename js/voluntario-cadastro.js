/* PAWSAFE — formulário público de inscrição de voluntários.
   É o "formulário integrado à plataforma" do artigo: quem se inscreve entra como "Interessado"
   e aparece para a equipe em Voluntários & Equipe.
   Depende de: js/dados.js (PawData) e js/utils.js (PawUtils). */

const $ = (id) => document.getElementById(id);
const { today, checkboxes, checkedValues, maskPhone } = PawUtils;
const form = $('signupForm');

$('vSkills').innerHTML = checkboxes('skill', PawData.SKILLS);
$('vDays').innerHTML = checkboxes('day', PawData.DAYS);
$('vShifts').innerHTML = checkboxes('shift', PawData.SHIFTS);

$('vPhone').addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });

function showError(message) {
  $('signupError').textContent = message;
  $('signupError').classList.remove('d-none');
}

form.addEventListener('input', () => $('signupError').classList.add('d-none'));

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = {
    name: $('vName').value.trim(),
    email: $('vEmail').value.trim().toLowerCase(),
    phone: $('vPhone').value.trim(),
    skills: checkedValues(form, 'skill'),
    experience: $('vExperience').value.trim(),
    days: checkedValues(form, 'day'),
    shifts: checkedValues(form, 'shift')
  };

  // Mostra os erros do navegador (campos vazios, e-mail inválido) e depois as regras das caixas de marcar.
  if (!form.reportValidity()) return;
  if (data.phone.replace(/\D/g, '').length < 10) return showError('Informe o telefone com DDD.');
  if (!data.skills.length) return showError('Marque ao menos uma habilidade.');
  if (!data.days.length || !data.shifts.length) return showError('Marque ao menos um dia e um turno disponíveis.');

  const volunteers = PawData.loadVolunteers();
  const alreadyRegistered = volunteers.some(v => v.email === data.email);

  if (!alreadyRegistered) {
    volunteers.push({
      id: PawUtils.nextId(volunteers), ...data,
      role: 'Voluntário', status: 'Interessado', notes: '',
      source: 'Formulário', consent: true, createdAt: today()
    });
    if (!PawData.saveVolunteers(volunteers)) return showError('Não foi possível enviar agora. Tente novamente.');
  }

  $('signupDoneText').textContent = alreadyRegistered
    ? 'Este e-mail já está cadastrado. A equipe vai entrar em contato com você.'
    : `Obrigado, ${data.name.split(' ')[0]}! A equipe vai entrar em contato pelo telefone ou e-mail informado.`;
  form.classList.add('d-none');
  $('signupDone').classList.remove('d-none');
});

$('signupAgain').addEventListener('click', () => {
  form.reset();
  form.classList.remove('d-none');
  $('signupDone').classList.add('d-none');
  $('vName').focus();
});
