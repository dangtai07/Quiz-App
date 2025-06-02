// Initialize
let currentStep = 1;
let questions = [];
let questionCount = 0;
let autoSaveTimer;
let previewTimer;
let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', function() {
    updateStepIndicator();
    // setupAutoSave();
    loadDraftIfExists();
});

// =================== STEP MANAGEMENT ===================

function nextStep() {
    if (currentStep < 4) {
        if (validateCurrentStep()) {
            currentStep++;
            updateStepIndicator();
            showCurrentSection();
        }
    }
}

function previousStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepIndicator();
        showCurrentSection();
    }
}

function updateStepIndicator() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
}

function showCurrentSection() {
    // Hide all sections
    document.getElementById('quizInfoSection').style.display = 'none';
    document.getElementById('questionsSection').style.display = 'none';
    document.getElementById('finalSection').style.display = 'none';

    // Show current section
    switch(currentStep) {
        case 1:
            document.getElementById('quizInfoSection').style.display = 'block';
            break;
        case 2:
            document.getElementById('questionsSection').style.display = 'block';
            break;
        case 3:
        case 4:
            document.getElementById('finalSection').style.display = 'block';
            break;
    }
}

function validateCurrentStep() {
    switch(currentStep) {
        case 1:
            const title = document.getElementById('quizTitle').value.trim();
            if (!title) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Information',
                    text: 'Please enter a quiz title to continue.',
                    confirmButtonColor: '#667eea'
                });
                return false;
            }
            return true;
        case 2:
            if (questions.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Questions',
                    text: 'Please add at least one question to continue.',
                    confirmButtonColor: '#667eea'
                });
                return false;
            }
            
            // Validate each question
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                if (!question.content.trim()) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Empty Question',
                        text: `Question ${i + 1} is empty. Please add content.`,
                        confirmButtonColor: '#667eea'
                    });
                    return false;
                }
                
                if (question.type === 'multiple_choice') {
                    const validOptions = question.options.filter(opt => opt && opt.trim());
                    if (validOptions.length < 2) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Missing Options',
                            text: `Question ${i + 1} needs at least 2 answer options.`,
                            confirmButtonColor: '#667eea'
                        });
                        return false;
                    }
                    
                    if (!question.correctAnswer) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Missing Correct Answer',
                            text: `Question ${i + 1} needs a correct answer selected.`,
                            confirmButtonColor: '#667eea'
                        });
                        return false;
                    }
                }
            }
            return true;
        default:
            return true;
    }
}

// =================== QUESTION MANAGEMENT ===================

function addQuestion() {
    questionCount++;
    const newQuestion = {
        id: questionCount,
        type: 'multiple_choice',
        content: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        image: null
    };
    
    questions.push(newQuestion);
    
    const questionHtml = createQuestionHtml(questionCount);
    const container = document.getElementById('questionsContainer');
    container.insertAdjacentHTML('beforeend', questionHtml);
    
    updateQuestionCount();
    triggerAutoSave();
    
    // Scroll to new question
    setTimeout(() => {
        const element = document.getElementById(`question-${questionCount}`);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 100);
}

// =================== AUTO-SAVE FUNCTIONALITY ===================

function saveDraft() {
    // Prepare questions for saving (exclude File objects which can't be serialized)
    const questionsForSaving = questions.map(q => ({
        ...q,
        image: q.image ? {
            preview: q.image.preview || null,
            hasFile: !!q.image.file
        } : null
    }));

    const quizData = {
        title: document.getElementById('quizTitle').value,
        mode: document.getElementById('quizMode').value,
        language: document.getElementById('quizLanguage').value,
        startTime: document.getElementById('startTime')?.value || '',
        endTime: document.getElementById('endTime')?.value || '',
        questions: questionsForSaving,
        currentStep: currentStep,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('modern_quiz_draft', JSON.stringify(quizData));
    showAutoSaveIndicator();
}

function loadDraftIfExists() {
    const draft = localStorage.getItem('modern_quiz_draft');
    if (draft) {
        try {
            const quizData = JSON.parse(draft);
            // Show option to restore draft
            Swal.fire({
                title: 'Draft Found',
                text: 'Would you like to restore your previous draft?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#667eea',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Restore Draft',
                cancelButtonText: 'Start Fresh'
            }).then((result) => {
                if (result.isConfirmed) {
                    restoreDraft(quizData);
                } else {
                    localStorage.removeItem('modern_quiz_draft');
                }
            });
        } catch (error) {
            console.error('Error loading draft:', error);
            localStorage.removeItem('modern_quiz_draft');
        }
    }
}

function restoreDraft(quizData) {
    // Restore basic info
    document.getElementById('quizTitle').value = quizData.title || '';
    document.getElementById('quizMode').value = quizData.mode || 'online';
    document.getElementById('quizLanguage').value = quizData.language || 'vietnamese';
    
    if (quizData.startTime) document.getElementById('startTime').value = quizData.startTime;
    if (quizData.endTime) document.getElementById('endTime').value = quizData.endTime;
    
    // Toggle schedule settings if needed
    toggleScheduleSettings();
    
    // Restore questions
    questions = quizData.questions || [];
    questionCount = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 0;
    
    // Render questions
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    questions.forEach(question => {
        const questionHtml = createQuestionHtml(question.id);
        container.insertAdjacentHTML('beforeend', questionHtml);
        
        // Populate question data
        setTimeout(() => {
            const contentElement = document.getElementById(`question-${question.id}-content`);
            if (contentElement) {
                contentElement.value = question.content;
            }
            
            const typeElement = document.getElementById(`question-${question.id}-type`);
            if (typeElement) {
                typeElement.value = question.type;
                toggleQuestionType(question.id, question.type);
            }
            
            // Restore image preview if available
            if (question.image && question.image.preview) {
                const uploadZone = document.querySelector(`#question-${question.id} .image-upload-zone`);
                if (uploadZone) {
                    uploadZone.classList.add('has-image');
                    uploadZone.innerHTML = `
                        <input type="file"
                               id="image-${question.id}"
                               accept="image/*"
                               style="display: none;"
                               onchange="handleImageUpload(${question.id}, this)">
                        <img src="${question.image.preview}" alt="Question Image" 
                             style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-danger" 
                                    onclick="removeImage(${question.id}, event)" type="button">
                                <i class="fas fa-trash me-1"></i> Remove
                            </button>
                        </div>
                    `;

                    // Fetch the image and create a File object
                    fetch(question.image.preview)
                        .then(res => res.blob())
                        .then(blob => {
                            const fileName = `question_${question.id}_image.png`;
                            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
                            question.image.file = file;
                        })
                        .catch(err => {
                            console.error('Error creating file from image:', err);
                        });
                }
            }
        }, 100);
    });
    
    // Update counts
    updateQuestionCount();
    
    // Restore step
    currentStep = quizData.currentStep || 1;
    updateStepIndicator();
    showCurrentSection();
    
    Swal.fire({
        title: 'Draft Restored!',
        text: 'Your previous work has been restored.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
}

// =================== PREVIEW FUNCTIONALITY ===================

function previewQuiz() {
    if (!validateCurrentStep()) return;
    
    // Clear previous preview content
    document.getElementById('previewQuestionsContainer').innerHTML = '';
    document.getElementById('previewNavigator').innerHTML = '';
    
    // Set quiz info
    document.getElementById('previewTitle').textContent = document.getElementById('quizTitle').value || 'Untitled Quiz';
    document.getElementById('previewMode').textContent = document.getElementById('quizMode').value.charAt(0).toUpperCase() + 
        document.getElementById('quizMode').value.slice(1);
    document.getElementById('previewLanguage').textContent = document.getElementById('quizLanguage').value.charAt(0).toUpperCase() + 
        document.getElementById('quizLanguage').value.slice(1);

    // Set schedule if offline mode
    const scheduleEl = document.getElementById('previewSchedule');
    if (document.getElementById('quizMode').value === 'offline') {
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime && endTime) {
            scheduleEl.innerHTML = `
                <i class="fas fa-clock me-1"></i>
                <span>${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}</span>
            `;
        }
    } else {
        scheduleEl.innerHTML = '';
    }

    // Generate questions preview
    const previewContainer = document.getElementById('previewQuestionsContainer');
    const navigator = document.getElementById('previewNavigator');
    
    questions.forEach((question, index) => {
        // Create question preview
        let questionHTML = `
            <div class="preview-question p-4 mb-4" id="previewQuestion${index + 1}">
                <div class="d-flex align-items-start">
                    <div class="question-counter me-3">${index + 1}</div>
                    <div class="flex-grow-1">
                        <h5 class="mb-3">${question.content || 'Untitled Question'}</h5>`;
        
        // Add image if exists
        if (question.image) {
            let imageSrc = '';
            if (question.image.preview) {
                imageSrc = question.image.preview;
            } else if (typeof question.image === 'string' && question.image.startsWith('data:')) {
                imageSrc = question.image;
            }
            
            if (imageSrc) {
                questionHTML += `
                    <div class="mb-3 text-center">
                        <img src="${imageSrc}" alt="Question Image" class="img-fluid rounded" style="max-height: 300px;">
                    </div>`;
            }
        }
        
        // Add answer options
        if (question.type === 'multiple_choice') {
            questionHTML += '<div class="preview-options">';
            ['A', 'B', 'C', 'D'].forEach((letter, optIndex) => {
                const optionText = question.options[optIndex];
                if (optionText && optionText.trim()) {
                    questionHTML += `
                        <div class="preview-option" onclick="selectPreviewOption(this, ${index + 1})">
                            <div class="d-flex align-items-center">
                                <div class="option-indicator me-3">${letter}</div>
                                <div class="flex-grow-1">${optionText}</div>
                            </div>
                        </div>`;
                }
            });
            questionHTML += '</div>';
        } else {
            questionHTML += `
                <div class="mt-3">
                    <textarea class="form-control" rows="3" placeholder="Type your answer here..."></textarea>
                </div>`;
        }
        
        questionHTML += `
                    </div>
                </div>
            </div>`;
        
        previewContainer.innerHTML += questionHTML;
        
        // Add navigator button
        navigator.innerHTML += `
            <button class="btn btn-outline-primary btn-sm preview-navigator-btn" 
                    id="nav-btn-${index + 1}"
                    onclick="scrollToPreviewQuestion(${index + 1})">
                ${index + 1}
            </button>`;
    });

    // Start mock timer
    startMockTimer();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
}

function editQuiz() {
    // Close the preview modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) {
        modal.hide();
    }
    
    // Go back to questions step
    currentStep = 2;
    updateStepIndicator();
    showCurrentSection();
    
    // Scroll back to the top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset timer when modal is closed
document.getElementById('previewModal').addEventListener('hidden.bs.modal', function () {
    resetPreviewState();
});

// =================== PUBLISH FUNCTIONALITY ===================

function publishQuiz() {
    if (!validateCurrentStep()) return;
    
    Swal.fire({
        title: 'Publish Quiz?',
        text: "Your quiz will be available for students to take.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, publish it!'
    }).then((result) => {
        if (result.isConfirmed) {
            submitQuizToServer();
        }
    });
}

function submitQuizToServer() {
    // Show loading
    Swal.fire({
        title: 'Publishing Quiz...',
        text: 'Please wait while we publish your quiz.',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    // Prepare data in the format expected by your existing backend
    const quizInfo = {
        title: document.getElementById('quizTitle').value,
        mode: document.getElementById('quizMode').value,
        language: document.getElementById('quizLanguage').value,
        scheduleSettings: null
    };

    // Add schedule settings if mode is offline
    if (quizInfo.mode === 'offline') {
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime && endTime) {
            quizInfo.scheduleSettings = {
                startTime: startTime,
                endTime: endTime
            };
        }
    }

    // Prepare questions data
    const questionsData = questions.map((question, index) => ({
        number: index + 1,
        content: question.content,
        type: question.type,
        options: question.type === 'multiple_choice' 
            ? question.options.map((text, optIndex) => ({
                letter: String.fromCharCode(65 + optIndex), // A, B, C, D
                text: text || ''
            })).filter(opt => opt.text.trim())
            : [],
        correctAnswer: question.correctAnswer || []
    }));

    // Create FormData (matching your existing API format)
    const formData = new FormData();
    formData.append('quizInfo', JSON.stringify(quizInfo));
    formData.append('questionsData', JSON.stringify(questionsData));

    // Add image files with the correct field names expected by backend
    questions.forEach((question, index) => {
        if (question.image && question.image.file) {
            // Use the fieldname format expected by your backend
            formData.append(`questionImage_${index + 1}`, question.image.file);
        }
    });

    // Submit to your existing endpoint
    fetch('/quizzes', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Network response was not ok');
            });
        }
        return response.json();
    })
    .then(data => {
        // Clear draft
        localStorage.removeItem('modern_quiz_draft');
        
        Swal.fire({
            title: 'Success!',
            text: 'Your quiz has been published successfully.',
            icon: 'success',
            confirmButtonText: 'View Quiz Dashboard'
        }).then(() => {
            window.location.href = '/quizzes';
        });
    })
    .catch(error => {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: error.message || 'Failed to publish quiz. Please try again.',
            confirmButtonColor: '#667eea'
        });
    });
}

// =================== UTILITY FUNCTIONS ===================
window.questions = questions;
window.questionCount = questionCount;
window.autoSaveTimer = autoSaveTimer;
window.previewTimer = previewTimer;
window.hasUnsavedChanges = hasUnsavedChanges;
// Expose functions for global access
window.nextStep = nextStep;
window.previousStep = previousStep;
window.addQuestion = addQuestion;
window.previewQuiz = previewQuiz;
window.editQuiz = editQuiz;
window.publishQuiz = publishQuiz;