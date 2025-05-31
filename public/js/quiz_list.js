// document.addEventListener('DOMContentLoaded', function() {
//     // Filter functionality
//     function applyFilters() {
//         const searchText = document.getElementById('searchQuiz').value.toLowerCase();
//         const modeFilter = document.getElementById('filterMode').value;
//         const languageFilter = document.getElementById('filterLanguage').value;

//         document.querySelectorAll('.quiz-card').forEach(card => {
//             const title = card.querySelector('.card-title').textContent.toLowerCase();
//             const mode = card.querySelector('.quiz-mode').dataset.mode;
//             const language = card.querySelector('.quiz-language').dataset.language;

//             const matchesSearch = title.includes(searchText);
//             const matchesMode = !modeFilter || mode === modeFilter;
//             const matchesLanguage = !languageFilter || language === languageFilter;

//             card.closest('.col-md-6').style.display = 
//                 matchesSearch && matchesMode && matchesLanguage ? 'block' : 'none';
//         });
//     }

//     // Delete quiz
//     async function deleteQuiz(quizId) {
//         try {
//             const result = await Swal.fire({
//                 title: 'Are you sure?',
//                 text: "You won't be able to revert this!",
//                 icon: 'warning',
//                 showCancelButton: true,
//                 confirmButtonColor: '#d33',
//                 cancelButtonColor: '#3085d6',
//                 confirmButtonText: 'Yes, delete it!'
//             });

//             if (result.isConfirmed) {
//                 const response = await fetch(`/quizzes/${quizId}`, {
//                     method: 'DELETE'
//                 });

//                 if (!response.ok) throw new Error('Failed to delete quiz');

//                 Swal.fire(
//                     'Deleted!',
//                     'Quiz has been deleted.',
//                     'success'
//                 ).then(() => {
//                     window.location.reload();
//                 });
//             }
//         } catch (error) {
//             Swal.fire(
//                 'Error!',
//                 error.message,
//                 'error'
//             );
//         }
//     }

//     // Event listeners
//     document.getElementById('searchQuiz').addEventListener('input', applyFilters);
//     document.getElementById('filterMode').addEventListener('change', applyFilters);
//     document.getElementById('filterLanguage').addEventListener('change', applyFilters);
    
//     // Make functions globally available
//     window.deleteQuiz = deleteQuiz;
// });