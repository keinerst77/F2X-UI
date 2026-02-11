angular.module('fileComparatorApp')
.directive('autoFocusOnShow', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            let hasBeenFocused = false;
            
            // Observar cuando el elemento se vuelve visible
            scope.$watch(function() {
                return element[0].offsetParent !== null;
            }, function(isVisible) {
                if (isVisible && !hasBeenFocused) {
                    console.log('🎯 Directiva detectó que textarea es visible');
                    hasBeenFocused = true;
                    
                    // Múltiples intentos de habilitación con delays escalonados
                    const delays = [0, 100, 200, 300, 500];
                    
                    delays.forEach(delay => {
                        $timeout(function() {
                            // Forzar habilitación
                            element[0].disabled = false;
                            element[0].readOnly = false;
                            element[0].removeAttribute('disabled');
                            element[0].removeAttribute('readonly');
                            element[0].style.pointerEvents = 'auto';
                            element[0].style.display = 'block';
                            element[0].style.userSelect = 'text';
                            element[0].style.webkitUserSelect = 'text';
                            element[0].tabIndex = 0;
                            
                            // Forzar foco
                            element[0].focus();
                            
                            // Mover cursor al final
                            const length = element[0].value ? element[0].value.length : 0;
                            element[0].setSelectionRange(length, length);
                            
                            // Simular eventos múltiples
                            const events = [
                                new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
                                new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
                                new MouseEvent('click', { bubbles: true, cancelable: true }),
                                new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: '' }),
                                new FocusEvent('focus', { bubbles: true, cancelable: true })
                            ];
                            
                            events.forEach(event => element[0].dispatchEvent(event));
                            
                            console.log(`✅ [${delay}ms] Directiva habilitó y enfocó el textarea`);
                        }, delay);
                    });
                }
            });
            
            // Escuchar evento personalizado para forzar re-habilitación
            element[0].addEventListener('force-enable', function() {
                console.log('⚡ Forzando habilitación por evento personalizado');
                element[0].disabled = false;
                element[0].readOnly = false;
                element[0].focus();
            });
        }
    };
}]);