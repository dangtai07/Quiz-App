// Standalone Quiz Preview JavaScript - Based on form.js preview logic
let questions = [];
let currentPreviewQuestion = 0;
let previewTimer = null;
let timeRemaining = 0;
let isTimerActive = false;
let selectedAnswer = null;

const DEFAULT_ANSWER_TIME = 30;

document.addEventListener('DOMContentLoaded', function() {
    initializePreview();
    setupColorObserver();
});

// =================== INITIALIZATION ===================

function initializePreview() {
    // Load quiz data from hidden script tag
    const quizDataElement = document.getElementById('quiz-data');
    if (quizDataElement) {
        try {
            const quizData = JSON.parse(quizDataElement.textContent);
            questions = quizData.questions || [];
            
            if (questions.length === 0) {
                showNoQuestionsMessage();
                return;
            }
            
            // Initialize preview
            currentPreviewQuestion = 0;
            selectedAnswer = null;
            
            // Display first question
            displayCurrentQuestion();
            updateProgress();
            
            console.log('Standalone preview initialized with', questions.length, 'questions');
        } catch (error) {
            console.error('Error parsing quiz data:', error);
            showErrorMessage();
        }
    } else {
        console.error('Quiz data not found');
        showErrorMessage();
    }
}

// =================== QUESTION DISPLAY ===================

function displayCurrentQuestion() {
    if (currentPreviewQuestion >= questions.length) {
        finishQuiz();
        return;
    }
    
    const question = questions[currentPreviewQuestion];
    const container = document.getElementById('previewQuestionContainer');
    
    // Reset selected answer for new question
    selectedAnswer = null;
    
    // Update question progress indicator
    document.getElementById('previewQuestionProgress').textContent = 
        `${currentPreviewQuestion + 1} of ${questions.length}`;
    
    // Build question HTML
    let questionHTML = `
        <div class="preview-question-header">
            <div class="preview-question-number">${currentPreviewQuestion + 1}</div>
            <div class="preview-question-content">
                <h5 class="preview-question-title">${question.content || 'Untitled Question'}</h5>
            </div>
        </div>
    `;
    
    // Add image if exists
    if (question.image) {
        questionHTML += `
            <div class="preview-question-image">
                <img src="${question.image}" alt="Question Image">
            </div>
        `;
    }
    
    // Add answer options with color classes
    questionHTML += '<div class="preview-options">';
    question.options.forEach(option => {
        if (option.text && option.text.trim()) {
            const colorClass = `letter-${option.letter.toLowerCase()}`;
            questionHTML += `
                <div class="preview-option" 
                     data-letter="${option.letter}" 
                     data-correct="${question.correctAnswer === option.letter ? 'true' : 'false'}"
                     onclick="selectPreviewOption(this, '${option.letter}')">
                    <div class="preview-option-content">
                        <div class="preview-option-letter ${colorClass}">${option.letter}</div>
                        <div class="preview-option-text">${option.text}</div>
                        <div class="preview-option-status"></div>
                    </div>
                </div>
            `;
        }
    });
    questionHTML += '</div>';
    
    container.innerHTML = questionHTML;
    
    // Apply color classes after DOM insertion
    setTimeout(() => {
        applyOptionColors();
    }, 100);
    
    // Start timer for this question
    startQuestionTimer(question.answerTime || DEFAULT_ANSWER_TIME);
    
    // Update navigation buttons
    updateNavigationButtons();
}

// =================== OPTION SELECTION ===================

function selectPreviewOption(element, letter) {
    if (!isTimerActive) return; // Can't select after time is up
    
    // Store selected answer
    selectedAnswer = letter;
    
    // Remove previous selection
    const parent = element.closest('.preview-options');
    if (parent) {
        parent.querySelectorAll('.preview-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        element.classList.add('selected');
    }
    
    console.log('Selected option:', letter, 'for question', currentPreviewQuestion + 1);
}

// =================== TIMER MANAGEMENT ===================

function startQuestionTimer(seconds) {
    timeRemaining = seconds;
    isTimerActive = true;
    
    // Hide next button initially
    document.getElementById('nextBtn').style.display = 'none';
    document.getElementById('finishBtn').style.display = 'none';
    
    updateTimerDisplay();
    
    previewTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            stopTimer();
            onTimeUp();
        }
    }, 1000);
}

function stopTimer() {
    if (previewTimer) {
        clearInterval(previewTimer);
        previewTimer = null;
    }
    isTimerActive = false;
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    document.getElementById('timerMinutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('timerSeconds').textContent = seconds.toString().padStart(2, '0');
    
    // Update timer circle color based on time remaining
    const timerCircle = document.querySelector('.quiz-timer-compact .timer-circle');
    if (!timerCircle) return;
    
    const totalTime = questions[currentPreviewQuestion]?.answerTime || DEFAULT_ANSWER_TIME;
    const percentageLeft = (timeRemaining / totalTime) * 100;
    
    timerCircle.classList.remove('warning', 'danger');
    
    if (percentageLeft <= 10) {
        timerCircle.classList.add('danger');
    } else if (percentageLeft <= 30) {
        timerCircle.classList.add('warning');
    }
}

// =================== TIME UP HANDLING ===================

function onTimeUp() {
    const currentQuestion = questions[currentPreviewQuestion];
    const correctAnswer = currentQuestion.correctAnswer;
    
    // Find all options in current question
    const options = document.querySelectorAll('.preview-option');
    
    options.forEach(option => {
        const optionLetter = option.getAttribute('data-letter');
        const isCorrect = option.getAttribute('data-correct') === 'true';
        const statusElement = option.querySelector('.preview-option-status');
        
        if (isCorrect) {
            // Mark correct answer
            option.classList.add('correct');
            statusElement.innerHTML = '<i class="fas fa-check-circle text-success"></i>';
        } else if (selectedAnswer === optionLetter) {
            // Mark user's wrong selection
            option.classList.add('wrong');
            statusElement.innerHTML = '<i class="fas fa-times-circle text-danger"></i>';
        }
    });
    
    // Show appropriate navigation button
    if (currentPreviewQuestion < questions.length - 1) {
        document.getElementById('nextBtn').style.display = 'inline-block';
    } else {
        document.getElementById('finishBtn').style.display = 'inline-block';
    }
    
    // Disable option selection
    options.forEach(option => {
        option.style.pointerEvents = 'none';
        option.style.opacity = '0.8';
    });
}

// =================== NAVIGATION ===================

function nextQuestion() {
    if (currentPreviewQuestion < questions.length - 1) {
        currentPreviewQuestion++;
        selectedAnswer = null; // Reset for next question
        displayCurrentQuestion();
        updateProgress();
        console.log('Moved to question', currentPreviewQuestion + 1);
    }
}

function updateNavigationButtons() {
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');
    
    // Next and Finish buttons are controlled by timer
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
}

function updateProgress() {
    const progress = ((currentPreviewQuestion + 1) / questions.length) * 100;
    const progressBar = document.getElementById('previewProgress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
}

// =================== QUIZ COMPLETION ===================

function finishQuiz() {
    stopTimer();
    
    // Show completion message with options
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Quiz Preview Complete!',
            text: `You've reviewed all ${questions.length} questions.`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Restart Preview',
            cancelButtonText: 'Exit Preview',
            confirmButtonColor: '#667eea',
            cancelButtonColor: '#64748b'
        }).then((result) => {
            if (result.isConfirmed) {
                restartPreview();
            } else {
                // Could redirect back to dashboard or stay on page
                window.history.back();
            }
        });
    } else {
        // Fallback if SweetAlert is not available
        const restart = confirm(`Quiz preview complete! You've reviewed all ${questions.length} questions.\n\nWould you like to restart the preview?`);
        if (restart) {
            restartPreview();
        } else {
            window.history.back();
        }
    }
    
    console.log('Quiz preview finished');
}

function restartPreview() {
    currentPreviewQuestion = 0;
    selectedAnswer = null;
    stopTimer();
    displayCurrentQuestion();
    updateProgress();
}

// =================== COLOR MANAGEMENT ===================

function applyOptionColors() {
    // Apply colors to preview option letters
    document.querySelectorAll('.preview-option-letter').forEach(element => {
        const letter = element.textContent.trim();
        const colorClass = `letter-${letter.toLowerCase()}`;
        element.classList.add(colorClass);
    });
    
    // Apply colors to option indicators (fallback)
    document.querySelectorAll('.option-indicator').forEach(element => {
        const letter = element.textContent.trim();
        const colorClass = `letter-${letter.toLowerCase()}`;
        element.classList.add(colorClass);
    });
}

function setupColorObserver() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Apply colors to any new option letters
                    const optionLetters = node.querySelectorAll('.preview-option-letter, .option-indicator');
                    optionLetters.forEach(element => {
                        const letter = element.textContent.trim();
                        if (letter && letter.length === 1) {
                            const colorClass = `letter-${letter.toLowerCase()}`;
                            element.classList.add(colorClass);
                        }
                    });
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// =================== ERROR HANDLING ===================

function showNoQuestionsMessage() {
    const container = document.getElementById('previewQuestionContainer');
    container.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-question-circle fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No Questions Available</h5>
            <p class="text-muted">This quiz doesn't have any questions to preview.</p>
            <a href="/quizzes" class="btn btn-primary">
                <i class="fas fa-arrow-left me-2"></i>Back to Dashboard
            </a>
        </div>
    `;
    
    // Hide timer and progress
    const timerElement = document.querySelector('.quiz-timer-compact');
    const progressElement = document.querySelector('.progress');
    if (timerElement) timerElement.style.display = 'none';
    if (progressElement) progressElement.style.display = 'none';
}

function showErrorMessage() {
    const container = document.getElementById('previewQuestionContainer');
    container.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h5 class="text-warning">Error Loading Quiz</h5>
            <p class="text-muted">There was an error loading the quiz data.</p>
            <button onclick="location.reload()" class="btn btn-primary me-2">
                <i class="fas fa-refresh me-2"></i>Retry
            </button>
            <a href="/quizzes" class="btn btn-secondary">
                <i class="fas fa-arrow-left me-2"></i>Back to Dashboard
            </a>
        </div>
    `;
    
    // Hide timer and progress
    const timerElement = document.querySelector('.quiz-timer-compact');
    const progressElement = document.querySelector('.progress');
    if (timerElement) timerElement.style.display = 'none';
    if (progressElement) progressElement.style.display = 'none';
}

// =================== GLOBAL FUNCTIONS ===================

// Make functions available globally
window.selectPreviewOption = selectPreviewOption;
window.nextQuestion = nextQuestion;
window.finishQuiz = finishQuiz;
window.restartPreview = restartPreview;