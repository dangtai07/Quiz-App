let answers = {};
let timer;

document.addEventListener('DOMContentLoaded', function() {
    initTimer(45 * 60); // 45 minutes
    initAnswers();
});

function initTimer(duration) {
    let time = duration;
    timer = setInterval(function() {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (--time < 0) {
            clearInterval(timer);
            submitAnswers(true);
        }
    }, 1000);
}

function initAnswers() {
    const questions = document.querySelectorAll('.preview-question');
    questions.forEach((question, index) => {
        answers[index + 1] = null;
    });
}

function selectOption(element, questionNum) {
    const parent = element.closest('.preview-options');
    parent.querySelectorAll('.preview-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    
    answers[questionNum] = element.dataset.letter;
    updateProgress();
    autoSave();
}

function saveTextAnswer(questionNum, value) {
    answers[questionNum] = value.trim();
    updateProgress();
    autoSave();
}

function scrollToQuestion(num) {
    document.getElementById(`question${num}`).scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

function updateProgress() {
    const total = Object.keys(answers).length;
    const answered = Object.values(answers).filter(v => v !== null).length;
    const progress = (answered / total) * 100;
    
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
}

function autoSave() {
    localStorage.setItem('quizAnswers', JSON.stringify(answers));
}

function submitAnswers(isTimeout = false) {
    if (isTimeout || confirm('Are you sure you want to submit your answers?')) {
        clearInterval(timer);
        // Implement submit logic here
    }
}